## Area: Inbox (STORY-INB-nnn)

Source: `docs/ux-paths/inbox/catalog.md`.


Generated: 2026-10-17
Code read: `the repository root` at `559a76ad` (branch `docs/ux-pass`, merged with current `origin/main`). PR #109 (`origin/feat/legal`) was read with `git show` for the Data room import only; it is not part of this commit.
Total Stories: 40 (short 23, medium 13, long 4)
Previous catalog: 2026-10-16, 24 stories (STORY-INB-001..024). This version keeps every id, rewrites the steps to match the code as it is now, and adds STORY-INB-025..040.

**Persona for every story.** A naive first-time user: a startup founder who has never seen Rakazo or its code, does not know its words ("triage", "noise", "agent", "Data room", "approval"), and only wants to run their company clearly and consistently. In the stories they are called **Maya**, the founder of the mock company. Steps say what Maya would try, in her words, and mark **Hesitation** where she would likely pause or misread a label. "UNVERIFIED" marks a behaviour read from code but not seen running; the walker should record what actually appears.

**Scope note on the Data room.** On this commit the Data room has **no** "Import from email" and the Inbox has no "Save to Data room" action; the agent has only `data_room_search` and `data_room_read` (`builtin-tools.ts:1021-1028`), no tool that adds files. The way to file a mail attachment is: download it, then **Choose files** on the Data room page or drop it on any app page (STORY-INB-016, 022, 024). **PR #109 (`origin/feat/legal`)** adds `ImportFromEmail.tsx` to the Data room page (a button "Import from email", or "Connect Gmail" when none is connected, that opens a picker of mail with attachments). The main-branch path stays the primary path in every story; each Data-room story says what changes once #109 merges.

---

### Changes since the 2026-10-16 catalog

**Kept:** all of STORY-INB-001..024 keep their ids, so earlier findings stay traceable. Stories whose substance did not change: 007 (filters), 021 (two inboxes), and the sync notices 017/018 apart from small wording.

**Changed (same id, steps or labels rewritten):**
- 001: empty state is now a titled page ("No mail connected" plus a line, `Inbox.tsx:746-755`) instead of a lone button; the pen icon has a hover tooltip; a Connected Gmail card on Integrations has an "Open Inbox" link.
- 002: consent card now explains what Maya gets (needs-reply, to-dos, groups) and has a **Not now** button (`AiDataSharing.tsx:69-96`). The old complaint "no Not now button" is gone.
- 003: toast and focus details; dialog buttons now stay in one line on phones.
- 004: toast stays 10 s (was 6), says only "Archived"; Archive inside the dialog now **closes** the dialog (it used to jump to the next message); icon tooltips exist (the old "aria-label only" note was wrong).
- 005: the tooltip now says "Mark noise: all mail from {sender}" and the toast names the sender; the "no explanation" hesitation applies only to the More menu on touch.
- 006: search hint now reads "Search mail, e.g. from:sam has:attachment".
- 007: unchanged behaviour; M11 removed from the Important expectation (depends on the seed).
- 008: **the conversation view now exists** (was "Thread view does not exist"): heading "N messages", collapsed earlier lines that expand in place, and "Later in this conversation".
- 009, 010, 011, 012, 013: composer wording ("Show original message" pill, From line on replies, "Remove attachments?" dialog with "Close and remove", attachment-too-big text, shared Reply / Reply all draft with a "Continue draft" link).
- 014: a to-do's text now opens its email; done to-dos stay in place and are struck through.
- 015: result lines "Downloaded {file}" / "Couldn't download {file}" replace "Download failed"; sizes use binary units with one decimal ("30.0 MB").
- 016: rewritten for main vs PR #109 (see Scope note).
- 017: the Inbox notice still has no Reconnect link; the walk now goes through Integrations.
- 018: now also lists "Couldn't reach Gmail.".
- 019: the panel opens from an **Ask** button; duplicate intro noted; cards in the dialog now include Archive / Mark read.
- 020: the agent **can** send through the card (old text "You can read mail but not send" is gone); card states are now "Approved to send", "Sent by you", "Not sent", "Unknown".
- 021, 022, 023, 024: rewritten to the current flows.

**Dropped:** none. Nothing in the 24 stories lost its behaviour; two old claims were removed from them (thread view missing; agent cannot send).

**Added:** 025 sorting wait and stall; 026 turning AI sorting off in Settings; 027 her reply joins the conversation; 028 editing and sending from the agent's card, failure and Open in composer; 029 a failed send returns her message; 030 keyboard-only Inbox; 031 phone-width Inbox; 032 agent panel collapse and phone behaviour; 033 sidebar search to Inbox; 034 Hide amounts; 035 turn off sending for the agent; 036 archive from an email card in chat; 037 new mail while the app is open; 038 Back button and deep links; 039 Discard and Undo a draft; 040 phone Monday catch-up (long).

---

### Mock demo data (shared preconditions)

The walk runs against a seeded mock demo account. Everything below is fake and must be labeled as such in the seed. Stories reference these items by their key (for example `M1`, `T2`).

**Space and person**
- Space / company name: `Northwind Robotics`.
- Signed-in user: `Maya Okafor (MOCK)`, subscription active, onboarding complete, so `/app` loads the Shell.

**Mail accounts** (Gmail connections, provider stubbed)
- `A1` `maya@northwind-robotics.example` — label "Northwind (MOCK)". Connected in every story unless a story says otherwise.
- `A2` `maya.okafor.personal@example.test` — label "Personal (MOCK)". Connected only in stories that say "two accounts".

**Cached messages on `A1`** (all in INBOX, received within the 14-day cache window unless noted)

| Key | From | Subject | State |
|-----|------|---------|-------|
| M1 | Priya Shah `<priya@harbor-vc.example>` | Re: Series A term sheet — redlines | Conversation of 4 messages (all cached); newest today 08:12; unread; needsReply=true; priority important; attachment `Northwind_TermSheet_v3_redline.pdf` (1,258,291 bytes, shown "1.2 MB") on the newest message; message 1 carries the original term sheet PDF; one earlier message is Maya's own reply |
| M2 | Stackyard Cloud Billing `<billing@stackyard.example>` | Invoice #4471 — October hosting | today 07:40; unread; category billing; body and preview contain "$4,820.00 due Nov 10"; attachment `INV-4471.pdf` (184,320 bytes, "180.0 KB") |
| M3 | Luis Romero `<luis@acme-logistics.example>` | Can we move Thursday's demo to Friday? | today 09:30; unread; needsReply=true; category scheduling |
| M4 | Robotics Weekly `<news@roboticsweekly.example>` | This week: humanoid grippers, funding roundup | yesterday; read; category newsletter |
| M5 | Google `<no-reply@accounts.google.example>` | Security alert: new sign-in on Mac | yesterday; unread; category security |
| M6 | Luis Romero `<luis@acme-logistics.example>` | Signed MSA — Acme Logistics x Northwind | 4 days ago; read; attachment `Acme_Northwind_MSA_signed.pdf` (3,565,158 bytes, "3.4 MB") |
| M7 | Dana Kim `<dana@northwind-robotics.example>` | Factory walkthrough video | 3 days ago; read; attachments `factory_walkthrough.mov` (31,457,280 bytes, "30.0 MB") and `floorplan.png` (2,202,009 bytes, "2.1 MB") |
| M8 | Figma `<receipts@figma.example>` | Your Figma receipt | 5 days ago; read; category receipt |
| M9 | Sam Lee `<sam@northwind-robotics.example>` | Board meeting prep — Oct 23 | 2 days ago; read; To Maya, Cc 4 people (Priya Shah, Ken Ito, Ana Duarte, Ravi Menon) |
| M10 | Ken Ito `<ken@ito-cpa.example>` | W-9 for Northwind | **20 days ago** (outside the 14-day cache; findable only by Gmail search) |
| M11 | "Maya Okafor" `<ceo@northwlnd-robotics.example>` (look-alike domain) | Urgent: wire transfer update | today 06:55; unread; category suspicious (row shows the "Suspicious" warning icon) |
| M13 | Priya Shah `<priya@harbor-vc.example>` | Re: Series A term sheet — signed | `NEW-MAIL` seed: delivered to Gmail two minutes after the Inbox page loads |

**Cached messages on `A2`** (two-account stories only)
- M12 Bright Dental `<appointments@brightdental.example>` — "Reminder: cleaning on Oct 21" — today; unread; category scheduling.

**To-dos from mail** (`InboxTodo`, triage on)
- T1 "Send the redlined term sheet back to Priya" — from Priya Shah, detail "Asked for comments by Friday", due today, priority important, `messageId` = M1.
- T2 "Pay invoice #4471" — from Stackyard Cloud Billing, due in 4 days, `messageId` = M2.
- T3 "Confirm Friday demo time with Luis" — from Luis Romero, no due date, `messageId` = M3.
- T4 "Send W-9 to Ken" — done yesterday, `messageId` = null (left the cache).

**Triage and AI consent**
- `CONSENT-PENDING`: triage blocked with reason `needs_consent` (recipient = the triage model provider). No categories, no to-dos.
- `CONSENT-GIVEN`: consent allowed, triage has run, all rows above carry their categories and needsReply.
- `TRIAGE-SLOW`: after Allow, triage stays pending for more than 60 s, then finishes.

**Sync and send states (per story)**
- `SYNC-OK`: `lastSyncedAt` = 2 minutes ago, no errors.
- `SYNC-RECONNECT`: `A1` has `lastErrorAt` set and `needsReconnect=true`.
- `SYNC-RATELIMIT`: `A1` has `lastErrorAt` set and `lastErrorKind=rate_limited`.
- `SEND-FAIL`: the Gmail stub rejects the first send with a generic error, then accepts. `SEND-RECONNECT`: send fails with "reconnect". `SEND-UNKNOWN`: the stub accepts but the answer is lost.

**Agents**
- `AGENT-NONE`: no Inbox agent exists yet.
- `AGENT-READY`: Inbox agent exists (spawn key for Maya), empty thread.
- `CARD-PENDING`: in the Inbox agent thread, one pending `mail_send` approval card: To `luis@acme-logistics.example`, subject "Re: Can we move Thursday's demo to Friday?", body "Hi Luis, Friday at 2pm works for us. See you then. — Maya", replyToId = M3.
- `CARD-FAIL`: like CARD-PENDING, but the person's edited send fails once.

**Data room**
- `DR-EMPTY`: Data room has no items; Data room AI consent may be off.
- `DR-SEEDED`: Data room contains `Acme_Northwind_MSA_signed.pdf` already, for the duplicate edge case.

---

### Summary

| Type | Count |
|------|-------|
| Short | 23 |
| Medium | 13 |
| Long | 4 |

### Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Connect mail, empty state | 001, 022 | Where Google sends her back after sign-in is UNVERIFIED |
| Mail list (groups, unread, labels, rows) | 003, 004, 021, 031 | |
| Conversation (thread) view | 008, 027, 024 | Older-than-14-day messages and earlier attachments are not shown |
| Consent (AI data sharing) | 002, 025, 026 | `no_model` blocked state has no UI |
| Triage (Important, categories, marks) | 005, 007, 025 | No list of marked senders |
| Archive / read / undo | 003, 004, 036 | |
| Reply / reply all / forward | 009, 010, 011, 013 | |
| New message, From picker, attachments | 012, 039 | |
| Failed / retried / undone send | 010, 029, 039 | Outbox for desktop host not applicable |
| Approval cards (agent send) | 020, 023, 028, 035 | Auto-allow rules in Settings ("Ask before sending external email") not walked |
| Search, filters, load more | 006, 007, 033, 038 | |
| Sync, rate-limit, reconnect notices | 017, 018, 029 | |
| New mail, unread badge, notifications | 037 | No notification exists |
| To-dos from mail | 014, 022 | No way to add, edit or delete a to-do |
| Attachments (download, into Data room) | 015, 016, 022, 024 | No direct "Save to Data room"; #109 adds one on the Data room page |
| Inbox agent panel, intro, email cards | 019, 023, 032, 036 | Duplicate intro (suspected) |
| Agent panel collapse, phone width | 031, 032, 040 | |
| Keyboard | 030, 009 (alt path), 040 | `?` only from the list |
| Two accounts | 012, 021 | |
| Hide amounts | 034 | List rows are not masked |
| Back button, deep links | 038 | |

### Story Dependency Graph

```text
STORY-INB-001 (Connect mail from an empty Inbox)
└── STORY-INB-002 (Allow AI sorting)
    ├── STORY-INB-025 (Sorting wait/stall) ── STORY-INB-026 (Turn it off in Settings)
    ├── STORY-INB-003 (Read, then mark unread)
    ├── STORY-INB-004 (Archive and undo) ── STORY-INB-036 (Archive from an agent card)
    ├── STORY-INB-005 (Mark noise)
    ├── STORY-INB-007 (Filters and Important)
    ├── STORY-INB-014 (To-dos)
    ├── STORY-INB-008 (Read a conversation)
    │   └── STORY-INB-009 (Reply) ── STORY-INB-027 (Reply joins the conversation)
    │       ├── STORY-INB-010 (Reply all + Undo) ── STORY-INB-013 (Continue a draft)
    │       └── STORY-INB-029 (Failed send) ── STORY-INB-039 (Discard + Undo)
    ├── STORY-INB-011 (Forward with attachments)
    ├── STORY-INB-015 (Download attachments) ── STORY-INB-016 (Attachment into Data room)
    ├── STORY-INB-006 (Search older mail) ── STORY-INB-033 (Sidebar search), STORY-INB-038 (Back/deep link)
    ├── STORY-INB-019 (Ask the Inbox agent) ── STORY-INB-020 (Approve a card)
    │       ├── STORY-INB-028 (Edit + send / failed edited send)
    │       ├── STORY-INB-035 (Turn off sending)
    │       └── STORY-INB-032 (Panel collapse, phone)
    ├── STORY-INB-030 (Keyboard only)
    ├── STORY-INB-031 (Phone width)
    ├── STORY-INB-034 (Hide amounts)
    └── STORY-INB-017 / 018 / 037 (Reconnect / rate limit / new mail; independent seeds)
STORY-INB-012, STORY-INB-021 need two accounts (A1 + A2)
Long: 022 (first morning), 023 (agent drafts replies), 024 (term sheet day), 040 (phone Monday)
```

---

### Stories: Getting started

#### STORY-INB-001: "Where is my email?" — connect mail from an empty Inbox

**Type**: short
**Topic**: Inbox first run
**Persona**: Maya, first-time founder, just signed in
**Goal**: See her company email inside the app.
**Preconditions**: MOCK DEMO DATA space; **no mail accounts connected**; AGENT-NONE.
**Ideal path**: 3 — click Inbox, click Connect mail, finish Google sign-in and find the Inbox again.
**Alternate paths**: Sidebar Integrations page, search "gmail"; once Gmail is connected, the Gmail card on the Integrations home page has an **Open Inbox** link (`IntegrationsHome.tsx:213-217`).

##### Steps
1. Clicks **Inbox** in the left sidebar (`Shell.tsx:3470-3480`) → `/app/inbox`. Heading "Inbox", a search box, a **Filter** funnel button, a pen icon (Compose) that is greyed out, and an **Ask** button (`Inbox.tsx:563-713`).
2. Below the header there is a centered empty state: mail icon, title "**No mail connected**", the line "Connect Gmail to read, sort and answer your mail here.", and a **Connect mail** button (`Inbox.tsx:746-755`). She **expects** this to send her to Google. **Hesitation**: the line does not say that the app will read her mail only after she approves, or whether it can send as her. The "Important" toggle is absent because there is nothing to sort yet.
3. Clicks **Connect mail** → `/app/integrations?q=gmail` (`Shell.tsx:4358`), the Integrations page filtered to Gmail.
4. Connects Gmail there (the Integrations flow is covered by the Integrations area catalog; here it is only the doorway).
5. Clicks **Inbox** in the sidebar → skeleton rows while the first sync runs (`Inbox.tsx:756-761`), then mail. **Hesitation**: if she finishes sign-in and sees the Integrations page, nothing says "go to Inbox"; the **Open Inbox** link only appears on the connected Gmail card on the Integrations home (UNVERIFIED which page Google returns her to; the walker should record it).

##### Variations
- She clicks the greyed pen icon first → nothing happens and no tooltip appears (a disabled button shows no tooltip, `Inbox.tsx:695-711`).
- She presses `c` → nothing (`Inbox.tsx:507` passes no compose handler when there are no accounts).
- She clicks **Ask** (button label "Ask", `aria-label` "Ask Inbox agent") before connecting → the side panel opens with only a **Create Inbox agent** button (STORY-INB-032). The agent exists before any mail does.

##### Edge Cases
- The search box and Filter button are live but have nothing to search.

#### STORY-INB-002: "Let Rakazo sort your mail" — allow AI sorting

**Type**: short
**Topic**: Triage consent
**Persona**: Maya, cautious about investor email going to an AI provider
**Goal**: Decide whether to let the app sort her mail.
**Preconditions**: A1 connected; CONSENT-PENDING; SYNC-OK; messages M1–M11.
**Ideal path**: 2 — read the card, click Allow.
**Alternate paths**: Account menu → Settings → "AI data sharing" has one switch per model (`AccountSettingsOverlay.tsx:139`, `AiDataSharing.tsx:99-153`); STORY-INB-026 covers turning it off.

##### Steps
1. Opens Inbox → rows appear in two groups, **Today** and **Earlier**. No "Needs reply" group, no **Important** toggle, no To do card, no Categories in the Filter menu.
2. At the top a card (`AiDataSharing.tsx:69-96`): "**Let Rakazo sort your mail**" — "Rakazo finds what needs a reply, lists your to-dos and groups mail like bills and newsletters. Senders, recipients, subjects and short previews are sent to the AI service that runs your bots ({model name})." Buttons **Allow** and **Not now**. She **expects** a clear yes/no and that "no" leaves her mail alone. **Hesitation**: "the AI service that runs your bots" — she has no bots yet and does not know who that is; the provider name in brackets helps only if she recognises it. The card says the previews go out but not that the full email bodies are not.
3. Clicks **Allow** → the card is replaced by "Sorting your mail…" (STORY-INB-025), then the **Needs reply** group, **Important** toggle and **To do** card appear.

##### Variations
- She clicks **Not now** → the card disappears for this visit only (`Inbox.tsx:157, 794-802`); it returns on the next visit. Nothing is stored.
- She ignores the card: the list works as a plain mail list.
- She searches or filters first: the card is hidden while a search or filter or Important view is active (`Inbox.tsx:792`).

##### Edge Cases
- **Allow** fails (offline) → the card shows a red error line and **Allow** is enabled again (`AiDataSharing.tsx:50-54`).

#### STORY-INB-025: "Sorting your mail…" — the first sort takes a while

**Type**: short
**Topic**: Triage in progress and stalled
**Persona**: Maya, just clicked Allow, impatient
**Goal**: Know whether the app is working or stuck.
**Preconditions**: A1 connected; consent just given; triage slow (seed `TRIAGE-SLOW`: stays pending for more than 60 s once, then finishes).
**Ideal path**: 1 — wait for the page to regroup once.
**Alternate paths**: **Try sorting again** after the stall message.

##### Steps
1. Right after **Allow**, the consent card is gone and a small spinner line reads "**Sorting your mail…**" (`Inbox.tsx:814-818`). Her rows stay where they are in plain **Today** / **Earlier** groups; badges, Needs reply and the To do card are held back so the page changes only once (`Inbox.tsx:150-151, 314-332`).
2. She scrolls; nothing jumps. The app checks every 5 s, up to 12 times (`Inbox.tsx:57-58, 249-260`).
3. After about a minute with no result, the spinner is replaced by "**Sorting is taking longer than usual. Your mail is below.**" and a **Try sorting again** button (`Inbox.tsx:804-813`). She **expects** the text to tell her what to do; the button does.
4. Clicks **Try sorting again** → the sync is run again and polling restarts (`Inbox.tsx:340-344, 262-282`). When it finishes, Needs reply, Important and To do appear together.

##### Variations
- Triage finishes during step 2 → the groups and the To do card show together; no stall text.
- She opens an email while sorting → it opens normally; marking read still works.

##### Edge Cases
- The unfiltered view only: a search or filter does not show the status line (`Inbox.tsx:792`).

#### STORY-INB-026: Change her mind — turn AI sorting off in Settings

**Type**: short
**Topic**: Consent withdrawal
**Persona**: Maya, after reading an article about AI and email
**Goal**: Stop Rakazo sending her mail details to the AI service.
**Preconditions**: A1; CONSENT-GIVEN; T1–T4 present.
**Ideal path**: 4 — account menu, Settings, switch off, back to Inbox.
**Alternate paths**: none found (no switch on the Inbox page itself).

##### Steps
1. Looks on the Inbox page for a setting; finds none (the Filter menu, the pen and Ask do not mention AI).
2. Opens the account menu (bottom of the sidebar) → Settings. In the Account tab, a section "**AI data sharing**" lists a switch labelled "Allow {model name}", on (`AiDataSharing.tsx:125-150`). Above it a generic sentence: "Messages, chat history, bot instructions, memories, attachments, screenshots and connected-app content are sent to run your bots…" (`ai-consent.ts:8-9`). **Hesitation**: the text says nothing about mail sorting, and the switch name is the model, not "Mail".
3. Switches it off → the switch turns off; no confirmation.
4. Back on Inbox → the To do card, Important toggle and Needs reply group are gone; the consent card is back (`Inbox.tsx:792-803`). **Hesitation**: she wonders whether her earlier to-dos were deleted; they are only hidden (`Inbox.tsx:347-352`).

##### Variations
- Switching it off turns off the AI bots' ability to run at all (same switch as for chat); UNVERIFIED how the Inbox agent chat responds. The walker should send a message to the Inbox agent after switching off and record what appears.

##### Edge Cases
- Revoke fails → red error line under the section title.

### Stories: Reading and triage

#### STORY-INB-003: Read an email, then mark it unread to come back later

**Type**: short
**Topic**: Mail list
**Persona**: Maya, wants to flag the hosting invoice for later
**Goal**: Look at an email and keep it bold so she remembers it.
**Preconditions**: A1; CONSENT-GIVEN; SYNC-OK; M2 unread.
**Ideal path**: 3 — open, Mark unread, close.
**Alternate paths**: Row hover button "Mark unread" (wide) or row **More** menu (narrow or touch) (`InboxRow.tsx:114-127, 196-279`).

##### Steps
1. Sees M2 bold with a blue dot (unread) and the sidebar **Inbox** showing an unread count badge.
2. Clicks the row → a large dialog opens with the subject, sender name and address, date and time, "to …", then buttons **Reply**, **Reply all**, **Forward**, **Archive**, **Mark read**, the body, and the `INV-4471.pdf 180.0 KB` chip (`InboxMessageDialog.tsx:277-309`). URL gains `?mail=<id>`.
3. After 0.8 s the message is marked read (`Inbox.tsx:480-491`); the dialog button flips to **Mark unread** and the sidebar count drops. **Hesitation**: the label flips silently; screen readers hear "Marked read" but sighted users get no notice (`Inbox.tsx:374-384`).
4. Clicks **Mark unread** → button flips back to **Mark read**.
5. Presses Esc or the X → back on the list; M2 is bold again; the row has focus and a left accent bar (`Inbox.tsx:523-535`).

##### Variations
- She opens and closes within 0.8 s → it stays unread (so stepping with j/k does not mark everything read).
- Phone width: the dialog is full screen and Archive / Mark read show as icons only (`InboxMessageDialog.tsx:295, 303`).

##### Edge Cases
- No toast and no Undo for read/unread changes.

#### STORY-INB-004: Archive the newsletter, then undo

**Type**: short
**Topic**: Triage actions
**Persona**: Maya, clearing noise
**Goal**: Get the newsletter out of the way, then change her mind.
**Preconditions**: A1; CONSENT-GIVEN; M4 in inbox.
**Ideal path**: 2 — Archive, Undo.
**Alternate paths**: row hover Archive icon, row More → Archive, dialog **Archive** button, key `e` on the list or in the dialog.

##### Steps
1. Hovers M4 → icons appear on the right: Archive, Mark read/unread, a star (Mark important), a bell-off (Mark noise). Hovering each shows its name in a tooltip (`InboxRow.tsx:199-246`). **Hesitation**: touch screens have no hover; she must find the **More** (…) button.
2. Clicks the Archive icon → the row disappears; bottom toast "**Archived**" with **Undo**, visible for 10 s (`Inbox.tsx:60, 537-556`).
3. Clicks **Undo** → the row comes back after the server confirms (`Inbox.tsx:404-416`).

##### Variations
- Archives from inside the dialog → the dialog **closes** and she lands on the list with the same toast (`Inbox.tsx:917-925`). Earlier versions jumped to the next message.
- Presses `e` while the dialog is open → archives and closes the dialog; she must reopen the next one by hand.

##### Edge Cases
- The archive applies to the whole Gmail conversation (`inbox-modify.ts`); the toast does not say so.
- Rows that are not in the Inbox (some search results, a reply she sent) have no Archive button (`InboxRow.tsx:115`).

#### STORY-INB-005: "Mark noise" on one newsletter mutes the sender everywhere

**Type**: short
**Topic**: Triage marks
**Persona**: Maya, wants fewer newsletters at the top
**Goal**: Tell the app this newsletter is not important.
**Preconditions**: A1 and A2 connected; CONSENT-GIVEN; M4 from `news@roboticsweekly.example`.
**Ideal path**: 1 — click Mark noise.
**Alternate paths**: More menu → "Mark noise" checkbox item (`InboxRow.tsx:268-277`).

##### Steps
1. Hovers M4. Hovering the bell-off icon shows the tooltip "**Mark noise: all mail from Robotics Weekly**" (`InboxRow.tsx:104-107`). She reads it and understands it is about the sender.
2. Clicks it → the row text dims; toast "**Mail from Robotics Weekly is now marked as noise**" with **Undo**, for 10 s (`Inbox.tsx:541-543`).
3. Turns on **Important** → M4 is gone, as expected. Every future Robotics Weekly email on either account is also dimmed and dropped from Important (`inbox.ts:363-374`).
4. **Hesitation (touch / More menu)**: on a phone she uses **More** → "Mark noise"; that item has no "all mail from" hint, only the toast after the fact.

##### Variations
- She marks Priya (an investor) "important" → toast "Mail from Priya Shah is now marked important"; every Priya email counts as important.
- She clicks the star or bell again to unmark → the button's pressed state toggles; no toast on unmark.

##### Edge Cases
- There is no list of marked senders anywhere, so she can only reverse a mark from a row that is still visible.

#### STORY-INB-006: Find last month's W-9 that is not in the list

**Type**: medium
**Topic**: Search
**Persona**: Maya, her accountant asks "did you get my W-9?"
**Goal**: Find an email from 20 days ago.
**Preconditions**: A1; SYNC-OK; M10 is 20 days old (outside the 14-day cache, `inbox.ts:36`).
**Ideal path**: 3 — type "W-9" in the search box, Enter, open the result.
**Alternate paths**: "Search older mail" button at the bottom of the list; key `/`; sidebar search (STORY-INB-033); ask the Inbox agent (STORY-INB-019).

##### Steps
1. Scrolls to the bottom looking for older mail → sees a quiet **Search older mail** button (`Inbox.tsx:895-905`). **Hesitation**: she expected the list to keep loading older mail as she scrolls.
2. Clicks it → the cursor moves to the search box, whose hint reads "**Search mail, e.g. from:sam has:attachment**" (`Inbox.tsx:589`). The hint tells her Gmail-style words work.
3. Types `W-9`, Enter → URL gets `?q=W-9`; the list becomes one date-ordered list under "1 result" with a **Clear** button (`Inbox.tsx:831-841`).
4. Opens M10 → message dialog. Buttons Archive / Mark read appear only if it is in the Inbox.
5. Tries `from:ken` → works; search text goes to Gmail as typed.
6. Presses Esc in the search box → search clears.

##### Variations
- More than one page of results: "N+ results" and **Load more**; at the end "No more results" (`Inbox.tsx:885-894`).
- A typo, `W9 kenn` → `No results for "W9 kenn"` with **Clear** (`Inbox.tsx:765-773`).

##### Edge Cases
- Search results lose the Needs reply grouping and the To do card; **Clear** restores them.
- Search plus the Important toggle or a category cannot combine; picking one drops the other (`inbox-list-input.ts:44-60`).

#### STORY-INB-007: "Show me only the important stuff" — Important toggle, filters, categories

**Type**: medium
**Topic**: Filters
**Persona**: Maya, 30 minutes before a board meeting
**Goal**: See only mail that matters, then only bills.
**Preconditions**: A1; CONSENT-GIVEN; M1–M11.
**Ideal path**: 2 — toggle Important; pick "Bills" from Filter.
**Alternate paths**: Ask the Inbox agent "what needs my reply today?" (STORY-INB-019).

##### Steps
1. Clicks **Important** (toggle button next to search) → URL `?view=important`; the list shows mail triage rated important or needing a reply: M1 and M3 (plus M11 only if the seed rated it important), under a result count; Today/Earlier headings disappear (`inbox.ts:363-374`). Hovering a row shows its reason as a tooltip (`InboxRow.tsx:134`).
2. Opens the Filter (funnel icon) menu → items: Unread, Starred, Has attachment; "Gmail tabs": Primary, Promotions, Social, Updates; "Categories": Bills, Receipts, Scheduling, Newsletters, Security, Notifications, Personal (`Inbox.tsx:642-683`).
3. **Hesitation**: with sorting on, Gmail's own "Important" item is not in this menu (it is replaced by the toggle, `Inbox.tsx:650-652`). The toggle means the app's own judgement, not Gmail's marker.
4. Picks **Bills** → Important turns off (they cannot combine); only M2 shows; the Filter button now reads "Bills" and the menu gets a **Clear** item.
5. Picks **Has attachment** → Bills is replaced, not added. **Hesitation**: she expected to combine "Bills" and "Has attachment".
6. Clicks the **Clear** button above the results → full list.

##### Variations
- With CONSENT-PENDING, the toggle and Categories group are missing and Gmail's "Important" is back inside the menu.

##### Edge Cases
- Unread / Starred / Has attachment / Gmail tabs read live from Gmail, while Bills and the other categories read the 14-day cache; the two lists can disagree about the same message.
- A filter that matches nothing → "No mail matches this filter" with **Clear** (`Inbox.tsx:774-782`).

#### STORY-INB-008: Read the whole term-sheet conversation

**Type**: short
**Topic**: Conversation (thread) view
**Persona**: Maya, needs to see what Priya and she said before replying
**Goal**: Read every message in the "Re: Series A term sheet" conversation.
**Preconditions**: A1; CONSENT-GIVEN; M1 thread with 4 messages (newest from Priya today, an earlier reply from Maya, two earlier from Priya), all within the 14-day cache.
**Ideal path**: 3 — open the thread, expand the earlier lines, read.
**Alternate paths**: Reply → "Show original message" to read the quoted history in the composer.

##### Steps
1. Sees one row for the conversation in **Needs reply** (one row per conversation, `inbox.ts:125-134`).
2. Opens it → the dialog shows the newest message in full, and above its body a small heading "**4 messages**" with a bordered list of the other three, one line each: sender (or **You** for her own), the first words, and the date and time (`InboxMessageDialog.tsx:325-333, 489-566`).
3. Clicks Priya's first message line → it expands in place to show the text; clicking again folds it (`InboxMessageDialog.tsx:510-565`). **Hesitation**: she expected one long scrolling conversation, as in Gmail; here the newest is open and the rest are collapsed lines. The heading says "4 messages", but the line for the *newest* message is not in the list, so she counts only three lines and wonders where the fourth is.
4. Scrolls down: if she has already replied, a second list "**Later in this conversation**" shows her own reply (`InboxMessageDialog.tsx:359-363`).
5. Clicks her own earlier message line → sees what she wrote.

##### Variations
- Uses the up/down chevrons hoping they step through the conversation → they step to the previous/next **row** in the list (`Inbox.tsx:913-915`).
- An earlier message that was HTML only → the expanded text falls back to the preview line (`InboxMessageDialog.tsx:558`).

##### Edge Cases
- Only messages in the 14-day cache are listed (up to 50), so an old thread shows a heading smaller than the real conversation (`inbox.ts:547-558`).
- Attachments of earlier messages are not shown or downloadable; only the opened message has chips.

### Stories: Writing mail

#### STORY-INB-009: Reply to Luis about moving the demo

**Type**: short
**Topic**: Reply
**Persona**: Maya
**Goal**: Say "Friday works" to a customer.
**Preconditions**: A1; M3 unread, needsReply.
**Ideal path**: 4 — open, Reply, type, Send.
**Alternate paths**: keys `r` (in the open message) then Cmd/Ctrl+Enter (STORY-INB-030); ask the Inbox agent (STORY-INB-020).

##### Steps
1. Opens M3 from **Needs reply** → message dialog.
2. Clicks **Reply** → a second dialog titled "**Reply**" over the first. It shows a **From** line (read-only: "Northwind (MOCK) <maya@northwind-robotics.example>"), **To** prefilled with Luis, **Subject** "Re: Can we move Thursday's demo to Friday?", the cursor above the quoted original, a formatting bar, and a round **Send** button (`ComposeEmail.tsx:539-577, 597-603`). The quoted original is folded behind a **Show original message** pill (`ComposeEmail.tsx:716-725`).
3. Types "Hi Luis — Friday at 2pm works. Maya". After a 1.5 s pause, "**Draft saved**" appears at the bottom right of the composer (`ComposeEmail.tsx:42, 254-257`).
4. Clicks **Send** → the composer closes at once and a bottom notice shows "**Sending…**" with **Undo** for 5 s, then "Sending…" without Undo, then "**Sent**" for 3 s (`outbox.ts:7-8, 38-62`). The message dialog is visible again.
5. **Hesitation**: she is back on Luis's original message with no confirmation text beyond the small "Sent"; she presses Esc to return to the list. The conversation now shows her reply (STORY-INB-027). Whether M3 leaves **Needs reply** at once depends on triage re-running (UNVERIFIED; the walker should record it).

##### Variations
- She tries to change From → there is no picker on replies; the account is fixed to the one the email came to.
- She clicks **Cc** or **Bcc** next to the To field → an extra row appears with its own focus.

##### Edge Cases
- The quoted original is sent even though it is hidden behind **Show original message**.
- **Send** with an empty To → red line "Add a recipient." (`ComposeEmail.tsx:468-471`).

#### STORY-INB-010: Reply all to the board prep thread, then pull it back

**Type**: medium
**Topic**: Reply all, Undo send
**Persona**: Maya, replying to 5 people
**Goal**: Send a time change to everyone, notice a mistake, undo it.
**Preconditions**: A1; M9 with 4 Cc recipients.
**Ideal path**: 6 — open, Reply all, type, Send, Undo, fix and Send.
**Alternate paths**: key `a` in the open message. There is no way to switch Reply to Reply all inside the composer.

##### Steps
1. Opens M9 → clicks **Reply all**. The composer is titled "Reply all".
2. More than three recipients and focus in the body → the recipient rows fold into one line: "Sam Lee, Priya Shah, Ken Ito +2 more" (`ComposeEmail.tsx:116, 616-623`; `RecipientSummary`). **Hesitation**: she cannot tell which people are To and which are Cc; clicking the line opens the full To / Cc rows.
3. Types "Moving prep to 4pm Thursday." and clicks **Send** → "Sending… Undo".
4. Realises she meant Wednesday; clicks **Undo** within 5 s → the composer reopens exactly as it was, same recipients and text (`outbox.ts:85-91`).
5. Fixes the day and sends → "Sending…" then "Sent".

##### Variations
- She waits more than 5 s before clicking Undo → Undo is gone; the mail is sent. There is no "unsend" after the hold.
- She removes Ravi from Cc using the chip's X (button "Remove …") → sent to 4.

##### Edge Cases
- An invalid typed address stays as a red chip; **Send** shows "{address} isn't a valid email address" or "Fix or remove the highlighted addresses." and does not send (`ComposeEmail.tsx:472-483`).

#### STORY-INB-011: Forward the signed MSA to the company lawyer

**Type**: medium
**Topic**: Forward, attachments
**Persona**: Maya
**Goal**: Send the signed contract to `counsel@ellis-law.example` with a short note.
**Preconditions**: A1; M6 with a 3.4 MB PDF; M7 with 30.0 MB + 2.1 MB attachments for the variation.
**Ideal path**: 4 — open, Forward, add recipient, Send.
**Alternate paths**: key `f`; download then attach manually in a New message.

##### Steps
1. Opens M6 → **Forward**.
2. Composer "**Forward**": To is empty and focused; the PDF shows in an Attachments row as a chip "Acme_Northwind_MSA_signed.pdf 3.4 MB" with a Remove X; the forwarded message sits in the body below the cursor.
3. Types `counsel@ellis-law.example`, presses Enter → address chip.
4. Types "Please file this." above the forwarded block and clicks **Send** → Sending… / Sent.

##### Variations
- Forwards M7 (30.0 MB video + 2.1 MB PNG) → a red line "**Attachments can't be over 10 MB.**" and **no** chips: when the total is too big the server drops every attachment (`inbox-compose.ts:127-138`; `ComposeEmail.tsx:322-326`; limit `contracts/src/inbox.ts:259`). **Hesitation**: she wanted to keep the small floor plan; she has to download it (STORY-INB-015) and attach it by hand. The red line can be replaced by "Draft saved" after her first keystroke (`ComposeEmail.tsx:257`).

##### Edge Cases
- Closing a forward after editing keeps a Gmail draft, but the app has no Drafts view; she only sees "You have an unsent reply" for replies (STORY-INB-013), not forwards.

#### STORY-INB-012: Write a new email from the right account

**Type**: medium
**Topic**: Compose, two accounts, attachments
**Persona**: Maya, with work and personal Gmail connected
**Goal**: Email an investor from the work address, attaching the pitch deck.
**Preconditions**: A1 + A2 connected; SYNC-OK; local files `Northwind_Deck_Oct.pdf` (MOCK, 6 MB) and `Northwind_Demo.mp4` (MOCK, 14 MB).
**Ideal path**: 5 — Compose, check From, To, Subject+body, attach, Send.
**Alternate paths**: key `c`; select an account tab first so From starts on it (`Inbox.tsx:943`).

##### Steps
1. Sees tabs **All / Northwind (MOCK) / Personal (MOCK)** under the heading (`Inbox.tsx:714-735`).
2. Clicks the pen icon (hover tooltip "Compose"; no visible text) → dialog "**New message**" with a **From** dropdown and To focused (`ComposeEmail.tsx:580-596`). **Hesitation**: the pen icon has no label until hover; she first looks for a "New" or "Compose" button.
3. From shows "Northwind (MOCK) <maya@northwind-robotics.example>". She checks it says Northwind.
4. Fills To `priya@harbor-vc.example`, Subject "Northwind deck — October", and a body.
5. Clicks the paperclip ("Attach files") → picks the deck → chip "Northwind_Deck_Oct.pdf 6.0 MB".
6. Drags the demo video in → red line "Northwind_Demo.mp4 (14.0 MB) was not added. Attachments can be up to 10 MB in total."; the video is not added (`ComposeEmail.tsx:451-457`).
7. **Send** → Sending… / Sent.

##### Variations
- She was on the **Personal** tab → From starts on Personal; easy to miss.
- Only one account connected → no dropdown; the From line is plain text.

##### Edge Cases
- She closes with an attachment → alert "**Remove attachments?**" — "Your text is saved as a draft. Attachments are not kept." — buttons **Keep editing** / **Close and remove** (`ComposeEmail.tsx:869-890`).

#### STORY-INB-013: Start a reply, get pulled away, continue later

**Type**: medium
**Topic**: Drafts
**Persona**: Maya, interrupted by a call
**Goal**: Not lose a half-written reply.
**Preconditions**: A1; M1.
**Ideal path**: 3 — close, reopen, keep typing.
**Alternate paths**: Gmail's own Drafts folder (outside the app).

##### Steps
1. Opens M1 → Reply → types two sentences → "Draft saved".
2. Closes the composer (X) and the dialog.
3. Later opens M1 → under the buttons a line "**You have an unsent reply to this email.**" with a **Continue draft** link (`InboxMessageDialog.tsx:310-322`). She clicks **Reply** or the link → her text is back (session memory, `draft-memory.ts:1-27`).
4. She clicks **Reply all** instead → her text comes back too, with Reply-all recipients (Reply and Reply all share one draft per message; `ComposeEmail.tsx:168-177`). Looking at the draft and closing without typing leaves it as written.
5. Reloads the browser and opens Reply → empty composer. The earlier text now exists only as a draft in Gmail's Drafts folder; the app has no Drafts view. Sending the new one creates a second message; the first draft stays in Gmail.

##### Variations
- A **New message** closed mid-way is never remembered (no key for "new"); it exists only as a Gmail draft.
- A **Forward** is remembered like a reply but the "unsent reply" line does not mention it.

##### Edge Cases
- The trash icon (Discard) closes the composer and shows "Draft discarded" with **Undo** for 5 s (STORY-INB-039).

#### STORY-INB-027: Her reply joins the conversation

**Type**: short
**Topic**: After sending
**Persona**: Maya, wants proof the reply went out
**Goal**: See that her reply to Luis is part of the conversation.
**Preconditions**: A1; M3; she has just sent the reply from STORY-INB-009.
**Ideal path**: 2 — look at the open message, scroll to the bottom.
**Alternate paths**: none found; the app has no Sent view.

##### Steps
1. After "Sent", the open message reloads by itself (`InboxMessageDialog.tsx:170-175`).
2. Scrolls to the bottom → a list "**Later in this conversation**" shows one line: **You**, the first words of her reply, and the time (`InboxMessageDialog.tsx:359-363`). She **expects** exactly this. The heading above the body now reads "2 messages".
3. Clicks the line → her sent text expands.

##### Variations
- The reply was sent by the Inbox agent after she approved a card → the same reload fires when the agent's run ends (`outbox.ts:99-113`; STORY-INB-020).

##### Edge Cases
- The reply sits in Gmail's Sent folder, not the Inbox, so it never appears as its own row in the list (rows need the Inbox label, `inbox.ts:385`); only searching can show it as a row marked **You**.

#### STORY-INB-029: The send fails and Maya gets her message back

**Type**: medium
**Topic**: Failed send, retry
**Persona**: Maya, on hotel Wi-Fi
**Goal**: Not lose a long reply when sending fails.
**Preconditions**: A1; M1; seed `SEND-FAIL` (the Gmail stub rejects the first send with a generic error, then accepts).
**Ideal path**: 4 — write, Send, read the problem, Send again.
**Alternate paths**: none found.

##### Steps
1. Opens M1 → Reply → writes three paragraphs → **Send**. The composer closes, "Sending… Undo" for 5 s, then "Sending…".
2. **Hesitation**: she goes back to reading; the failure arrives a moment later.
3. The composer **reopens by itself** with everything she wrote, and a red line at the bottom: "**Not sent. Couldn't send. Try again.**" (`outbox.ts:59-61`; `ComposeEmail.tsx:97-102, 119-120`).
4. Clicks **Send** again → "Sending…" then "Sent". The same message id is reused, so it cannot go out twice (`ComposeEmail.tsx:179`, comment at 148-151).

##### Variations
- Gmail needs reconnecting (seed `SEND-RECONNECT`) → "Not sent. Gmail needs to be reconnected." She must leave to the Integrations page; the composer is gone if she navigates (STORY-INB-017).
- Sending turned off for the workspace → "Not sent. Sending is turned off."
- Gmail accepted but the answer was lost (seed `SEND-UNKNOWN`) → "**Not confirmed as sent. Check Sent before trying again.**" (no "Not sent." prefix, `ComposeEmail.tsx:119-120`). The app has no Sent view, so "Sent" means Gmail's Sent folder.

##### Edge Cases
- She dismisses the reopened composer with X → it is kept as a session draft and "You have an unsent reply" returns on that message.

#### STORY-INB-039: Throw a draft away, then take it back

**Type**: short
**Topic**: Discard and Undo
**Persona**: Maya, regrets deleting a draft
**Goal**: Delete a half-written new email, then recover it.
**Preconditions**: A1 connected; a New message with a subject and two lines typed ("Draft saved" shown).
**Ideal path**: 2 — click the trash icon, click Undo.
**Alternate paths**: none found.

##### Steps
1. Clicks the trash icon at the bottom right of the composer (label "Discard", `ComposeEmail.tsx:850-866`) → the composer closes at once and a notice "**Draft discarded**" with **Undo** shows for 5 s (`MailOutbox.tsx:28-33`). **Hesitation**: it closes without asking; she expected a "Discard this draft?" question.
2. Clicks **Undo** within 5 s → the composer reopens with her text.
3. If she waits 5 s, the Gmail draft is deleted for good.

##### Variations
- An empty composer + Discard → closes at once, no notice (`ComposeEmail.tsx:406`).

##### Edge Cases
- Another send or discard during the 5 s hold makes the first one run immediately (`outbox.ts:64-69`).

### Stories: To-dos and attachments

#### STORY-INB-014: Work the "To do" list the app made from mail

**Type**: short
**Topic**: To-dos from mail
**Persona**: Maya
**Goal**: Open the email behind a to-do and tick off what she did.
**Preconditions**: A1; CONSENT-GIVEN; T1–T4.
**Ideal path**: 2 — click a to-do to open its email; tick it.
**Alternate paths**: find the email by hand in Needs reply; ask the agent.

##### Steps
1. Sees the **To do** card at the top: T1 "Send the redlined term sheet back to Priya" (due "Today", red) with a small line "Priya Shah · Asked for comments by Friday", T2 (due weekday), T3, then T4 struck through (`TodoCard.tsx:57-123`).
2. Clicks T1's text (shown as a link) → the term-sheet email opens in the message dialog (`TodoCard.tsx:94-103`; `Inbox.tsx:820-822`). She **expects** this.
3. Replies (STORY-INB-009) and Esc back to the list. Ticks T1's checkbox → struck through in place; it does not jump to the bottom (`TodoCard.tsx:25-34`).
4. On a narrow window only 2 open to-dos show plus "**1 more**" / "Show less" (`TodoCard.tsx:35-39, 124-134`).

##### Variations
- She wants to add her own to-do ("Call the bank") → there is no add field.
- She wants to remove a wrong to-do → only "done" exists.
- T4's email left the 14-day cache (`messageId` empty) → its text is plain, not a link.

##### Edge Cases
- A to-do whose email is open but not in the current list (for example after she filtered) shows the message without Archive / Mark read buttons (`Inbox.tsx:917-926`).
- A failed tick shows a red line in the card.

#### STORY-INB-015: Download attachments, including one that is too big

**Type**: short
**Topic**: Attachments
**Persona**: Maya
**Goal**: Save the invoice PDF and the factory video.
**Preconditions**: A1; M2 (180.0 KB), M7 (30.0 MB `.mov`).
**Ideal path**: 2 — open, click the attachment.
**Alternate paths**: none found in the web app.

##### Steps
1. Opens M2 → under the body, a chip "INV-4471.pdf 180.0 KB". Clicks it → the file downloads (saved, never opened in the page, `InboxMessageDialog.tsx:422-434`) and the line "**Downloaded INV-4471.pdf**" appears below (`InboxMessageDialog.tsx:478-482`).
2. **Hesitation**: she expected a preview; only the browser download happens.
3. Opens M7 → clicks `factory_walkthrough.mov` (30.0 MB) → red "**Couldn't download factory_walkthrough.mov**". The server refuses attachments over 25 MiB (`inbox.ts:40`), but the line gives no reason or alternative.

##### Variations
- Clicks `floorplan.png` → downloads fine.

##### Edge Cases
- The 25 MiB download limit and the 10 MB send limit are never stated on screen.

#### STORY-INB-016: Put the signed MSA into the Data room

**Type**: medium
**Topic**: Attachments into the Data room
**Persona**: Maya, building a diligence folder for the Series A
**Goal**: File the signed contract from email into the Data room.
**Preconditions**: A1; M6; DR-EMPTY (and DR-SEEDED for the duplicate edge case). **State on `main`**: there is no "Import from email" and no "Save to Data room" action anywhere in the Inbox or Data room.
**Ideal path**: 5 on `main` — open the email, download the PDF, open Data room, Choose files, pick the file. (With PR #109 it becomes 4; see the note below.)
**Alternate paths**: (a) download, then drag the file onto any app page: the global drop zone shows "Drop to add to Data room" (`DropZone.tsx:100-110`); (b) drag onto the Data room page.

##### Steps
1. Opens M6 → looks for a "Save to Data room" or "File" action near the attachment chip → none; the chip only downloads.
2. Clicks the chip → `Acme_Northwind_MSA_signed.pdf` downloads and "Downloaded Acme_Northwind_MSA_signed.pdf" appears.
3. Clicks **Data room** in the sidebar → empty page "**Drop files here**" — "Keep contracts, board decks and investor documents in one place." with a **Choose files** button (`DataRoom.tsx:347-362`). There is no Gmail button there on `main`.
4. Clicks **Choose files** → picks the file → a toast in the lower right with the file name, a progress bar, then "**Uploaded**" and **View** (`DropZone.tsx:158-170`).
5. **Hesitation**: she expected the Data room to know the file came from Luis's email; it has no link back, and she had to leave the email, find the download, and come back.

##### Variations
- She drags the downloaded file onto the Inbox list → the overlay "**Drop to add to Data room**" appears and the file uploads without leaving the Inbox.
- She drops it on an open composer instead → it attaches to the email, not the Data room (the composer takes the drop first, `DropZone.tsx:61-65`).
- Over 50 MB → "Over the 50 MB limit" on the toast (`DropZone.tsx:18-23`).

##### Edge Cases
- DR-SEEDED: uploading the same PDF again → the toast says "**Already in your Data room**" with **View** instead of "Uploaded" (`DropZone.tsx:25-32, 153-161`).
- **When PR #109 (`origin/feat/legal`) merges**: the Data room gets an **Import from email** button (shown as "Connect Gmail" when no account is connected) next to the add-files control (`ImportFromEmail.tsx:276-318`, `DataRoom.tsx` lines 353 and 371 on that branch). It opens a dialog "Import from email" with a search box (hint "Search mail"), lists mail that has attachments (Gmail's "has attachment" filter, with **Load more**), lets her expand a message to tick up to 20 files, and an **Import** button. Messages: "No files found" when empty; a red line with a **Reconnect** link when Gmail needs reconnecting. The path from the email then becomes: open Data room, **Import from email**, search "Acme", expand the message, tick the PDF, **Import**. It still does not add a button inside the Inbox message itself, so the Inbox-side hesitation in step 1 remains.

### Stories: Search and finding mail

#### STORY-INB-033: Search mail from the sidebar box

**Type**: short
**Topic**: Search entry point
**Persona**: Maya, types "term sheet" in the first search box she sees
**Goal**: Find the term-sheet email without knowing the Inbox has its own search.
**Preconditions**: A1; SYNC-OK; M1.
**Ideal path**: 2 — type, click the Mail row.
**Alternate paths**: the Inbox search box (STORY-INB-006).

##### Steps
1. In the left sidebar she types "term sheet" into the box labelled "**Search chats**" (`Shell.tsx:3445-3456`). **Hesitation**: the label says chats, but she wants mail; she tries it anyway.
2. The sidebar list is replaced by results with a **Mail** section containing one row "**Search mail for “term sheet”**", plus Chats, Files and Links sections if any match (`SpaceSearch.tsx:118-129`).
3. Clicks the Mail row → `/app/inbox?q=term%20sheet` opens with the Inbox search box filled and "1 result" (`Shell.tsx:3547-3549`).

##### Variations
- There are no chat matches → the Mail row is still offered, so "No results" does not appear.

##### Edge Cases
- Going back to the sidebar and clicking **Inbox** drops the search (the query lives in the URL only).

#### STORY-INB-038: Back button and a link straight to an email

**Type**: short
**Topic**: Navigation and deep links
**Persona**: Maya, uses the browser Back button without thinking
**Goal**: Open an email, press Back, and end up where she was.
**Preconditions**: A1; M1–M9; list scrolled to Earlier.
**Ideal path**: 2 — open an email, press the browser Back button.
**Alternate paths**: Esc or the X.

##### Steps
1. Clicks M6 in Earlier → the dialog opens and the address bar gains `?mail=<id>`; a history entry is added for it (`Inbox.tsx:454-459`).
2. Presses the browser **Back** button → the dialog closes and the list is where she left it, with the M6 row focused (`Inbox.tsx:460-465, 523-535`). She **expects** exactly this.
3. Pastes the same address into a new tab → the Inbox loads with M6's dialog already open. Archive and Mark read appear once the list has loaded and contains the row.

##### Variations
- Presses the X or Esc instead → same result, one history step back.
- Steps with j/k inside the dialog → the address bar updates without adding history entries (`Inbox.tsx:466-471`), so Back still closes the dialog in one press.

##### Edge Cases
- A link to an email that is not in the current list (older than 14 days, already archived, or a different filter) → the message opens, but the Archive and Mark read buttons are missing (`Inbox.tsx:917-926`).

### Stories: Reading with the amounts hidden

#### STORY-INB-034: Screen-share the board call without showing dollar amounts

**Type**: short
**Topic**: Hide amounts
**Persona**: Maya, about to share her screen with an investor
**Goal**: Keep dollar figures out of view while the Inbox is on screen.
**Preconditions**: A1; M2 "Invoice #4471 — October hosting" with "$4,820.00 due Nov 10" in the body and preview.
**Ideal path**: 2 — account menu, Hide amounts.
**Alternate paths**: none found (there is no button on the Inbox page).

##### Steps
1. Opens the account menu at the bottom of the sidebar → a row "**Hide amounts**" with the helper "Hides amounts on finance screens and masks currency amounts in chat text. Plain numbers in agent replies may still show." (`HideAmountsToggle.tsx:7-8, 35-62`). **Hesitation**: the helper names finance screens and chat, not email.
2. Clicks it → the row now reads "Show amounts".
3. Back on the Inbox, the list row for M2 still shows "$4,820.00 due Nov 10" in its preview (`InboxRow.tsx:175-176` renders subject and snippet as they are).
4. Opens M2 → the body shows "$•••" instead of the amount (`InboxMessageDialog.tsx:353`, `mask-currency.ts`). The earlier-message lines in a conversation are masked too.

##### Variations
- The email is HTML (a typical invoice) → the sandboxed viewer masks amounts in the text and attributes (`SandboxedHtmlViewer.tsx:62-74`).

##### Edge Cases
- Amounts in the subject line, the list preview and the email cards in the Inbox agent panel stay visible (see Suspected problems).

### Stories: Sync problems

#### STORY-INB-017: "Gmail needs to be reconnected"

**Type**: short
**Topic**: Reconnect notice
**Persona**: Maya, Google sign-in expired
**Goal**: Get mail flowing again.
**Preconditions**: A1 with SYNC-RECONNECT; cached rows M1–M9 still present.
**Ideal path**: 3 — read the notice, go to Integrations, reconnect.
**Alternate paths**: Integrations → Gmail app detail (covered by the Integrations area).

##### Steps
1. Opens Inbox → a red line "**Gmail needs to be reconnected.**" with a **Try again** button above the list (`Inbox.tsx:737-744`; `inbox-sync-error.ts:10`). Old rows still show below.
2. Clicks **Try again** → the sync runs again, fails the same way, and the line returns.
3. **Hesitation**: there is no **Reconnect** button or link; she does not know reconnecting happens on the Integrations page, and **Try again** cannot fix it.
4. Goes to Integrations via the sidebar and reconnects Gmail, then returns to Inbox.

##### Variations
- With two accounts, only one needs reconnecting → the message does not say which one.

##### Edge Cases
- Sending while disconnected → the composer reopens with "Not sent. Gmail needs to be reconnected." (STORY-INB-029).

#### STORY-INB-018: "Gmail is limiting requests right now"

**Type**: short
**Topic**: Rate-limit notice
**Persona**: Maya
**Goal**: Understand why mail is not updating.
**Preconditions**: A1 with SYNC-RATELIMIT.
**Ideal path**: 1 — read the message, wait, and press Try again.
**Alternate paths**: none found.

##### Steps
1. Opens Inbox → "**Gmail is limiting requests right now. Try again in a minute.**" and **Try again**.
2. Clicks **Try again** at once → same message.
3. Waits a minute, clicks again → the message goes and the list updates.

##### Variations
- Rate limit and reconnect at the same time on different accounts → only the reconnect text shows (`inbox-sync-error.ts:10-12`).
- Any other failure → "Couldn't reach Gmail." (`inbox-sync-error.ts:14`).

##### Edge Cases
- Nothing refreshes by itself after the minute; she must click.

#### STORY-INB-037: A new email arrives while she is looking at the Inbox

**Type**: short
**Topic**: New mail, unread count, notifications
**Persona**: Maya, waiting for Priya's reply
**Goal**: Notice when new mail arrives.
**Preconditions**: A1; SYNC-OK; the Inbox is open; seed `NEW-MAIL`: M13 from Priya "Re: Series A term sheet — signed" is delivered to Gmail two minutes after the page loaded.
**Ideal path**: 2 — open another page and come back.
**Alternate paths**: reload the browser; ask the Inbox agent.

##### Steps
1. Keeps the Inbox open for two minutes. The list does not change and the sidebar **Inbox** count stays the same. The page syncs once when it opens and again only after her own actions (`Inbox.tsx:263-282`; badge: `Shell.tsx:654-661, 3481-3490`).
2. **Hesitation**: she expects a new row to appear, a badge to change, or a sound. The app shows none of these, and she found no desktop or browser notification for new mail anywhere in the web app.
3. Clicks **Finance** then **Inbox** → the Inbox syncs on arrival, M13 appears at the top of **Today**, and the sidebar count goes up by one.
4. Asks the Inbox agent "anything new from Priya?" → it refreshes mail itself (its overview tool refreshes the cache) and lists M13.

##### Variations
- The Inbox agent's runs end → the agent is set to notify when it finishes (`inbox-agent.ts:29`); that is about the chat reply, not new mail.

##### Edge Cases
- Clicking **Inbox** in the sidebar while already on it does not appear to start a new sync (UNVERIFIED; the walker should record).

### Stories: Agent and approval cards

#### STORY-INB-019: Ask the Inbox agent "what needs my reply today?"

**Type**: medium
**Topic**: Inbox agent
**Persona**: Maya, would rather ask than scan
**Goal**: Get a short list of mail she must answer.
**Preconditions**: A1; CONSENT-GIVEN; AGENT-NONE (then AGENT-READY after step 3).
**Ideal path**: 4 — click Ask, click Create Inbox agent, ask, open a cited email.
**Alternate paths**: the Needs reply group and Important toggle on the page itself (same answer, two surfaces).

##### Steps
1. Sees an **Ask** button (speech-bubble icon, `aria-label` "Ask Inbox agent") at the right of the header (`AskBotButton.tsx`). Clicks it → a side panel opens with one **Create Inbox agent** button (`Shell.tsx:4432-4440`). **Hesitation**: she does not know what an "agent" is or whether creating one costs money.
2. Clicks **Create Inbox agent** → a short spinner, then the panel shows the agent's name "Inbox agent", a collapse icon, an intro and a message box.
3. The empty chat shows two introductions (UNVERIFIED in a browser; found by reading the code, see Suspected problems): "Searches your connected mail." with chips "What needs a reply from me today?" and "Summarize this week's investor email" (`Shell.tsx:4416-4427`), and below it "I read your mail, find what needs a reply and write replies. You approve each email before it is sent." with chips "What needs my reply today?", "Summarize what's new this week", "Find the latest invoice" (`InboxAgentIntro.tsx:14-26`).
4. Clicks "What needs my reply today?" → the question is sent; the agent answers with every item of its needs-reply list, each named by sender and subject, and shows **email cards** grouped "Today / Within 3 days / This week / Later" (`EmailCards.tsx:31-36, 51-54`).
5. Clicks the card for M1 → the same message dialog as the Inbox opens, with Reply, Reply all, Forward, **Archive** and **Mark read** (`EmailCards.tsx:110-137`).

##### Variations
- She clicks the agent's name at the top of the panel → it opens the agent's own page (`Shell.tsx:4385-4392`), leaving the Inbox. **Hesitation**: she expected a profile or menu.
- She asks the same thing again later → the existing agent and thread are reused.

##### Edge Cases
- With the panel open at 1024 px wide, the list is narrower; row badges and hover icons are squeezed.

#### STORY-INB-020: Approve the reply the agent wrote

**Type**: medium
**Topic**: Approval cards for sending
**Persona**: Maya
**Goal**: Let the agent send "Friday works" to Luis, after checking it.
**Preconditions**: A1; AGENT-READY; CARD-PENDING (To `luis@acme-logistics.example`, Subject "Re: Can we move Thursday's demo to Friday?", body "Hi Luis, Friday at 2pm works for us. See you then. — Maya", replyToId = M3).
**Ideal path**: 2 — read the card, click Send.
**Alternate paths**: write it herself (STORY-INB-009); edit first (STORY-INB-028).

##### Steps
1. Opens the Inbox agent panel → a card whose header reads "**Mail** Needs approval · luis@acme-logistics.example", with a small **Edit** button, the subject in bold, rows **From**, **To**, the message body (cut after about 6 lines with **Show more**), and two round buttons **Send** and **Discard**, plus a round **More** (…) button (`MailApprovalCard.tsx:190-220, 258-289, 403-456`).
2. **Hesitation**: "Needs approval" is the only hint that nothing has been sent; she wonders whether "Send" sends now. The intro line told her "You approve each email before it is sent", which helps.
3. Clicks **Send** without editing → the card folds to a header "**Mail Approved to send · luis@acme-logistics.example**" with the subject under it (`MailApprovalCard.tsx:209-215, 232-234`). When the agent's next run ends, the Inbox list reloads by itself (`outbox.ts:99-113`).
4. **Hesitation**: the card never changes to "Sent". "Approved to send" stays, because the "Sent by you" wording is set only when she edited and sent it herself (`MailApprovalCard.tsx:190-194`; `mail-approval-edit.ts` header comment). The agent's chat reply usually says what happened.

##### Variations
- **Discard** → header reads "Discarded"; nothing is sent and the agent is told.
- She leaves the panel closed while the card is pending → the card waits in the thread; it is visible again when she reopens the panel.

##### Edge Cases
- The agent's text instructs it that the user sees the card and approves, edits or discards it before anything is sent; the earlier contradiction ("You can read mail but not send") no longer exists (`inbox-agent.ts:5-12`). An Auto Review setting cannot skip this card for the Inbox agent (commit `11a4e97b`).
- The sent reply appears under "Later in this conversation" on M3 after the run ends (STORY-INB-027).

#### STORY-INB-028: Fix the agent's wording, then send it herself

**Type**: medium
**Topic**: Approval card edits, failed edited send
**Persona**: Maya, the agent's draft is almost right
**Goal**: Change "2pm" to "3pm" and add Priya on Cc before sending.
**Preconditions**: A1; AGENT-READY; CARD-PENDING for M3; a second seed `CARD-FAIL` where the edited send fails once.
**Ideal path**: 5 — Edit, change body, add Cc, Done, Send.
**Alternate paths**: Discard and write it herself.

##### Steps
1. On the pending card clicks **Edit** (the button becomes **Done** and the card gets a blue ring). Fields turn into inputs: Subject, To, Cc, Bcc (all three rows now show) and a multi-line Message box (`MailApprovalCard.tsx:293-340`). **Hesitation**: To/Cc are one text line each, comma-separated, not chips as in the composer.
2. Changes "2pm" to "3pm" and types `priya@harbor-vc.example` in Cc.
3. Clicks **Done**, reads the card, clicks **Send**. The card header changes to "**Sending…**"; the Send button also shows "Sending…" while the request runs.
4. When it finishes, the header reads "**Sent by you**" and the card folds up (`MailApprovalCard.tsx:190-194`). The agent is told the user edited and sent it themselves and must not send it again (`mail-approval-recovery.ts:15-21`).
5. **Hesitation**: nothing says that her edited send replaced the agent's own pending send, but the result is the same.

##### Variations
- `CARD-FAIL`: header reads "**Not sent**", the card stays open with a button **Open in composer**. Clicking it opens a regular composer with the To, Cc, subject and body filled, from the right account (`MailApprovalCard.tsx:470-476`; `Shell.tsx:7918-7929`). The agent is told the send failed and not to say it was sent.
- Outcome unclear: header reads "Unknown" with "Not confirmed as sent. Check Sent in your mail before trying again." (`MailApprovalCard.tsx:459-469`).
- She types a bad address (`priya@harbor`) in Cc and presses **Send** → red line "priya@harbor isn't a valid email address"; nothing is sent (`MailApprovalCard.tsx:147-154`).
- She empties To → red line "Add a recipient.".

##### Edge Cases
- A card that replaces a saved Gmail draft is "locked": the button reads **Send saved draft** and there is no **Edit** (`MailApprovalCard.tsx:101-102, 275, 419-420`).
- A "Save draft" card (the agent was asked only to draft) offers **Save draft** and **Discard**, and finishes as "Draft saved by you" or "Draft not saved".

#### STORY-INB-035: Turn off email sending for the Inbox agent

**Type**: short
**Topic**: Disable tool from the card
**Persona**: Maya, decides she never wants an agent to send for her
**Goal**: Stop the agent from asking to send email.
**Preconditions**: A1; AGENT-READY; CARD-PENDING.
**Ideal path**: 3 — More, Disable sending, Turn off.
**Alternate paths**: the agent's tools list on its own page (UNVERIFIED label; the walker should record).

##### Steps
1. On the pending card clicks the round **More** (…) button → one item "**Disable sending for Inbox agent**" (`MailApprovalCard.tsx:450-454`). **Hesitation**: the menu holds only this one item.
2. Clicks it → the buttons are replaced by "**Turn off sending for Inbox agent?**" with **Turn off** and **Cancel**; focus lands on Cancel, the safe choice (`MailApprovalCard.tsx:375-402`).
3. Clicks **Turn off** → the card also answers Discard, and a line shows "Sending is off for Inbox agent. Turn it back on in its tools." (`MailApprovalCard.tsx:139-166, 488-494`). **Hesitation**: "its tools" is not a link and she does not know where that is.

##### Variations
- **Cancel** → the normal Send / Discard buttons return.

##### Edge Cases
- If the tool call to turn it off fails, the card shows "Could not submit this answer" and stays pending (`MailApprovalCard.tsx:172`).

#### STORY-INB-036: Archive an email from an agent's card in chat

**Type**: short
**Topic**: Email cards in chat
**Persona**: Maya
**Goal**: Archive an email the agent listed without hunting for it in the list.
**Preconditions**: A1; AGENT-READY; the agent has shown email cards (M4 among them); the Inbox list is visible next to the panel.
**Ideal path**: 2 — open the card, click Archive.
**Alternate paths**: archive in the list (STORY-INB-004).

##### Steps
1. Clicks the card for M4 → the message dialog opens with **Archive** and **Mark read**.
2. Clicks **Archive** → the dialog closes at once (`EmailCards.tsx:117-122`). The list behind updates and M4 disappears without a reload (`Inbox.tsx:166-167`).
3. **Hesitation**: no "Archived · Undo" toast appears in this path; the toast belongs to the Inbox list only. She cannot undo from here.

##### Variations
- **Mark read** → the dialog keeps open; the button flips to **Mark unread**. A failed change flips it back and shows a red line under the cards (`EmailCards.tsx:123-142`).

##### Edge Cases
- Stepping with the chevrons or j/k moves through the cards in the order the agent listed them, not the Inbox order.

#### STORY-INB-032: Close and reopen the Inbox agent panel, on a desktop and on a phone

**Type**: short
**Topic**: Agent panel collapse
**Persona**: Maya, wants the list wider; later opens the app on her phone
**Goal**: Hide the agent when she does not need it, and not have it cover her mail on a phone.
**Preconditions**: A1; AGENT-READY; wide window first, then a 390 px wide window.
**Ideal path**: 2 — click Collapse, later click Ask.
**Alternate paths**: none found.

##### Steps
1. On a wide window, with the panel open, clicks the icon at its top right (`aria-label` "Collapse Inbox agent", `Shell.tsx:4400-4410`) → the panel slides away and an **Ask** button appears in the Inbox header (`Inbox.tsx:712`, `Shell.tsx:4348-4356`).
2. Reloads → the panel stays as she left it; opening it with **Ask** is remembered for the next visit on wide screens (`bots-sidebar-pref.ts:44-48`).
3. On a phone-width window (below 768 px) the panel always starts closed, even if she left it open on the desktop (`Shell.tsx:510`). **Ask** opens it as an overlay on top of the page, full width up to 384 px (`ResizableSidePanel.tsx:81`).
4. With the panel open she narrows a desktop window below 768 px → the panel closes by itself; the saved preference stays open for the desktop (`Shell.tsx:2682-2685`).

##### Variations
- She never opened the panel on this account: first visit on a phone shows only **Ask**; no agent exists yet.

##### Edge Cases
- The Ask button is hidden while the panel is open, so there is only one way to close it: the panel's own collapse icon.

### Stories: Keyboard and phone

#### STORY-INB-030: Clear the Inbox with the keyboard only

**Type**: medium
**Topic**: Keyboard shortcuts
**Persona**: Maya, learned Gmail shortcuts at her last job
**Goal**: Read, archive and reply without touching the mouse.
**Preconditions**: A1; CONSENT-GIVEN; M1–M9.
**Ideal path**: 12 — see Steps.
**Alternate paths**: the mouse (STORY-INB-003/004/009).

##### Steps
1. Presses `?` with focus on the page → a "Keyboard shortcuts" dialog lists: j Next message, k Previous message, Enter Open, o Open, / Search, c Compose, e Archive, r Reply, a Reply all, f Forward, ? Keyboard shortcuts, Esc Close (`InboxShortcuts.tsx:5-19`). **Hesitation**: nothing on the page tells her `?` exists; she tried it from habit. The arrow keys also work but are not listed.
2. Esc → closes it. Presses `j` → the first row gets a left accent bar and its hover icons show (`Inbox.tsx` via `useInboxKeyboard`; `InboxRow.tsx:197`). Holding `j` or pressing it faster than every 150 ms is ignored, on purpose (`inbox-keyboard.ts:27-32`).
3. Presses `Enter` (or `o`) → the message opens; after 0.8 s it is marked read.
4. Presses `r` → the Reply composer opens with the cursor in the body. Types her answer, then presses **Cmd+Enter** (Ctrl+Enter on Windows) → Sending… (`ComposeEmail.tsx:544-549`).
5. Presses `Esc` → the dialog closes. Presses `j` again, `Enter` to open the next one, then `e` → it is archived, the dialog closes and the "Archived" toast appears with Undo (`InboxMessageDialog.tsx:193`; `Inbox.tsx:917-925`).
6. Presses `/` → the search box is focused; types "invoice", Enter, Esc clears it (`Inbox.tsx:584-588`).
7. Presses `c` → "New message" opens.

##### Variations
- Inside an open message, `j` / `k` move to the next or previous row's message without closing the dialog, and `a` and `f` open Reply all and Forward (`InboxMessageDialog.tsx:181-198`).
- Keys typed in the search box, the composer or the agent's message box do nothing to the list (`inbox-keyboard.ts:53-57`).

##### Edge Cases
- `?` does not work while a message is open; the shortcut list can only be opened from the list.
- With the agent panel's message box focused, `j` types a letter, as expected.
- `e` in a message ends her reading: it archives and closes rather than moving on to the next message.

#### STORY-INB-031: Check the Inbox on a phone

**Type**: medium
**Topic**: Phone width
**Persona**: Maya, between meetings, on a 390 px wide phone
**Goal**: Answer Luis and archive a newsletter from the phone.
**Preconditions**: A1; CONSENT-GIVEN; M1–M9; viewport 390 × 844, touch.
**Ideal path**: 7 — see Steps.
**Alternate paths**: none found.

##### Steps
1. Opens the left menu (hamburger) → taps **Inbox** with its unread count. The header wraps: "Inbox" title, then **Important**, **Filter** and the pen at the top row, **Ask**, and the search box on its own row below (`Inbox.tsx:563-569`).
2. The To do card shows two open to-dos and "**1 more**"; **Needs reply**, **Today**, **Earlier** list below. Each row is two lines: sender and time, then subject and preview; a small dot replaces the "Needs attention" badge (`InboxRow.tsx:138-193`).
3. **Hesitation**: she looks for swipe-to-archive; there is none. Each row ends in a **More** (…) button, always visible on touch (`InboxRow.tsx:249-259`).
4. Taps **More** on M4 → a menu: Archive, Mark read, Mark important, Mark noise. Taps Archive → the row goes and "Archived" with **Undo** appears at the bottom.
5. Taps M3 → the message opens full screen. Buttons show icons only for Archive and Mark read; Reply, Reply all and Forward keep their words (`InboxMessageDialog.tsx:93, 295, 303`).
6. Taps **Reply** → a full-screen composer. The status text ("Draft saved") sits above the Send button, not beside it (`ComposeEmail.tsx:844`). She types and taps **Send**.
7. "Sending… Undo" appears at the bottom; she is back on the message. Taps X to return to the list.

##### Variations
- She taps **Ask** → the agent panel opens over the page, up to 384 px wide; the collapse icon closes it (STORY-INB-032).
- She rotates to landscape (width above 768 px) → the layout becomes the desktop one with columns.

##### Edge Cases
- Taps on the small pen icon, X and chevrons are enlarged on touch screens (`pointer-coarse:` classes).
- The pen icon has no text label on a phone; the tooltip needs hover.

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
2. Clicks **Northwind (MOCK)** → only A1 rows; the To do card shows A1 to-dos only (`Inbox.tsx:207-226`).
3. Reloads the page → back on **All**. The tab is not in the URL (`Inbox.tsx:117`, local state), unlike search and filters.

##### Variations
- Rows in All do not say which account they belong to.
- Clicking the pen on a tab starts New message with that account in From.

##### Edge Cases
- A removed account's tab silently falls back to All (`Inbox.tsx:194-196`).

### Stories: Long end-to-end

#### STORY-INB-022: First morning with the app — from empty Inbox to clear Inbox

**Type**: long
**Topic**: End-to-end
**Persona**: Maya, day one, 40 minutes before a customer call
**Goal**: Connect mail, understand what needs attention, answer two people, file one contract, and leave with nothing urgent left.
**Preconditions**: MOCK DEMO DATA space; no mail connected at start; after connecting, A1 has M1–M11 and CONSENT-PENDING; AGENT-NONE; DR-EMPTY. Main-branch behaviour (no "Import from email" yet).
**Ideal path**: 18 — connect (3), allow sorting (1), archive the suspicious email (1), reply to two (4+4), file one attachment (5).
**Alternate paths**: the agent route for the replies (STORY-INB-023); the keyboard route (STORY-INB-030).

##### Steps
1. Sidebar **Inbox** → "No mail connected" → **Connect mail** → Integrations → connects Gmail (STORY-INB-001).
2. Returns to Inbox by the sidebar → skeleton → **Today** / **Earlier** lists.
3. Reads the "Let Rakazo sort your mail" card → clicks **Allow** (STORY-INB-002) → "Sorting your mail…" (STORY-INB-025).
4. When it finishes, **Needs reply** (M1, M3), the **Important** toggle and the **To do** card appear at once.
5. **Hesitation**: M11 "Urgent: wire transfer update" has a small red warning triangle before the sender name. It is named "Suspicious" only for screen readers and has no visible text. She nearly opens it as a real message from herself ("Maya Okafor").
6. Archives M11 with the hover Archive icon → "Archived" + Undo.
7. Opens M3 → **Reply** → "Friday 2pm works." → **Send** → "Sending… Undo" → "Sent" (STORY-INB-009).
8. Presses Esc to leave the dialog.
9. Opens M1 → sees "4 messages" and three collapsed lines (STORY-INB-008); expands Priya's first line to recall the numbers → **Reply** → "Comments coming tonight." → **Send**.
10. Back on the list: clicks the T1 text "Send the redlined term sheet back to Priya" → M1 opens (STORY-INB-014). Closes it and ticks T3.
11. Hovers M4 → tooltip "Mark noise: all mail from Robotics Weekly" → clicks it (STORY-INB-005).
12. Opens M6 → downloads the MSA → sidebar **Data room** → **Choose files** → the toast shows "Uploaded" (STORY-INB-016). **Hesitation**: five steps and two pages for "put this email's attachment in the folder".
13. Back to **Inbox** → list reloads. M3 and M1 may still sit in **Needs reply** until triage runs again (UNVERIFIED). **Hesitation**: she replied to both and expected them to leave that group.
14. Turns on **Important** → checks nothing else is urgent → turns it off.
15. Presses `?` → "Keyboard shortcuts" dialog → notes `e` and `r` for tomorrow.

##### Variations
- She clicks **Not now** on the sorting card → steps 4, 10, 11, 14 are unavailable; the Inbox is a plain list and the card returns tomorrow.
- She asks the agent instead: Ask → Create Inbox agent → "What needs my reply today?" (STORY-INB-019).

##### Edge Cases
- If Gmail rate-limits during the first sync → STORY-INB-018 notice on step 2.

#### STORY-INB-023: "Draft replies to everything that needs one" — let the agent do it

**Type**: long
**Topic**: End-to-end (agent + approval cards)
**Persona**: Maya, wants the app to do the typing
**Goal**: Have the agent prepare replies for every Needs reply email, approve two, throw away one.
**Preconditions**: A1; CONSENT-GIVEN; M1, M3, M9 needsReply; AGENT-READY; mock agent runtime scripted to return `mail_send` approval cards (to Priya, Luis, Sam).
**Ideal path**: 7 — open panel, ask, review and Send two cards, Discard one, check the Inbox.
**Alternate paths**: reply by hand from each message (STORY-INB-009/010).

##### Steps
1. Clicks **Ask** → the panel opens on the existing thread (no Create button this time).
2. Types "Draft replies to everything that needs one. Keep them short." The agent reads its needs-reply list and the messages.
3. Cards appear titled "**Mail** Needs approval · <first recipient>". The run waits for each answer; whether the three cards arrive together or one after another depends on the live agent (UNVERIFIED; the walker should record which).
4. **Hesitation**: the intro told her the agent writes the replies and she approves each. If it answers in plain text instead of cards, there is no button to send those drafts and she must copy them into the composer; record which appears.
5. Card to Luis: reads it, clicks **Send** → folds to "**Approved to send**".
6. Card to Priya: clicks **Edit** → adds a line → **Done** → **Send** → "Sending…" → "**Sent by you**" (STORY-INB-028).
7. Card to Sam: clicks **Discard** → "Discarded".
8. Opens the folded Luis card header → it still says "Approved to send", not "Sent". She is unsure it went out.
9. Goes to the Inbox list. When the agent's run ended, the list reloaded (`outbox.ts:99-113`). She opens M3: the reply appears under "Later in this conversation" (STORY-INB-027) — the proof she needed.
10. Asks the agent "did the email to Luis go out?" → it answers from its tool result.
11. Opens M9 → no sign she skipped it; it stays in Needs reply.
12. Collapses the panel ("Collapse Inbox agent").

##### Variations
- At 1024 px the narrow panel squeezes the card; check that the recipient in the header is still readable before she approves.
- She uses More → "Disable sending for Inbox agent" on the first card → "Turn off sending for Inbox agent?" → later requests are refused by the app (STORY-INB-035).

##### Edge Cases
- A send whose result is unclear → "Unknown" with "Not confirmed as sent. Check Sent in your mail before trying again." and no link to Sent.

#### STORY-INB-024: Term-sheet day — read, file, forward, reply

**Type**: long
**Topic**: End-to-end (conversation, attachments, Data room, forward)
**Persona**: Maya, closing a Series A
**Goal**: Read Priya's redlines, file the redlined PDF in the Data room, forward it to counsel, reply to Priya, and close the to-do.
**Preconditions**: A1; CONSENT-GIVEN; M1 thread (4 messages, redline PDF on newest); T1; DR-EMPTY; local Downloads folder writable. Main-branch behaviour (no "Import from email").
**Ideal path**: 14 — search (2), open (1), download (1), Data room + Choose files (4), Forward + recipient + Send (3), Reply + text + Send (3).
**Alternate paths**: click T1 in the To do card to open the thread; ask the agent to find it; drag the downloaded PDF onto the page instead of Choose files.

##### Steps
1. Types "term sheet" into the Inbox search → Enter → "1 result" (thread) → opens it.
2. Sees "4 messages" and Priya's newest message in full, with the three earlier lines above (STORY-INB-008). Wants the original term sheet that came with message 1 → expands that line: only text, no attachments (`InboxMessageDialog.tsx:510-565`). She cannot reach message 1's PDF from here.
3. Clicks `Northwind_TermSheet_v3_redline.pdf 1.2 MB` → it downloads and "Downloaded …" appears.
4. Sidebar **Data room** → **Choose files** → picks the PDF → toast "Uploaded" → **View**.
5. Back to **Inbox**: the search is gone via the sidebar (it lives in the URL), so she types it again. **Hesitation**: she hoped the app remembered it.
6. Opens M1 → **Forward** → To `counsel@ellis-law.example` → "Redlines from Harbor. Can we talk at 5?" → **Send**.
7. The message dialog is visible again → **Reply** → "Thanks Priya — counsel is reviewing, comments by Friday." → **Send** → "Sent". The conversation heading goes from "4 messages" to "5 messages" (STORY-INB-027).
8. **Clear** search → the To do card returns → clicks T1's text → the thread opens; she ticks T1 afterwards.
9. Opens M1 → **Archive** → the dialog closes with "Archived" + Undo.
10. Wants to confirm the archived thread is safe. The toast is gone after 10 s, and the app has no "Archived" or "All mail" view; only a search finds it again.

##### Variations
- Counsel's address typed with a typo (`counsel@ellis-law`) → red chip, "counsel@ellis-law isn't a valid email address", Send blocked.
- **After PR #109 merges**: step 4 becomes Data room → **Import from email** → search "term sheet" → expand the message → tick the redline PDF → **Import**; she does not have to download first. Everything else is unchanged.

##### Edge Cases
- The redline PDF uploaded to the Data room has no record of coming from Priya's email.

#### STORY-INB-040: Monday morning catch-up on a phone

**Type**: long
**Topic**: End-to-end (phone width, triage, agent, send)
**Persona**: Maya, in a taxi, 15 minutes before the board meeting
**Goal**: See what is urgent, answer Luis, send the board prep reply to everyone, clear junk, and ask the agent about the invoice.
**Preconditions**: Viewport 390 × 844, touch; A1; CONSENT-GIVEN; M1–M11; AGENT-READY; saved panel preference "open" from her desktop (so the phone-start rule can be seen).
**Ideal path**: 16.
**Alternate paths**: use the Inbox agent for steps 4–10 (STORY-INB-019/020).

##### Steps
1. Opens the app on the phone and taps **Inbox** in the menu. The unread count is visible beside the name. The agent panel is closed even though she left it open on the desktop (STORY-INB-032).
2. The page loads from the cached list at once, then updates after the sync; she sees skeleton rows briefly (`Inbox.tsx:756-761`).
3. Reads the To do card: two items and "1 more"; taps "1 more" to see T3, then "Show less".
4. Taps **Important** → M1 and M3 under "2 results" (M11 if the seed rated it important). Taps **Clear**.
5. Taps M3 → full-screen message → **Reply** → full-screen composer → types "Friday 2pm works." → **Send**.
6. Back on M3 → taps X. She is back on the list. The "Sending… Undo" notice has become "Sent".
7. Taps M9 (board prep) → **Reply all** → the recipients fold into "Sam Lee, Priya Shah, Ken Ito +2 more" → types "Moving prep to 4pm." → **Send** → taps **Undo** within 5 s because she meant 4:30pm → fixes → **Send**.
8. Taps **More** on M11 → **Archive** → "Archived" + Undo; she ignores it.
9. Taps **More** on M4 → "Mark noise" → toast "Mail from Robotics Weekly is now marked as noise".
10. Taps **Filter** → **Bills** → sees M2 → opens it → taps `INV-4471.pdf` → the phone downloads the file, and "Downloaded INV-4471.pdf" appears.
11. Taps **Clear**, then **Ask** → the agent panel covers the page → asks "What did Priya say about the term sheet?" → the agent answers with a card for M1.
12. Taps the card → the message dialog opens over the panel → **Mark unread** to remember it.
13. Closes the dialog, taps the panel's collapse icon.
14. Types `from:ken` in the search row → Enter → one result (M10). Taps it, then Back in the phone browser → returns to the list with M10 focused.

##### Variations
- She rotates to landscape → desktop layout with columns and hover icons are absent (touch), More menu remains.

##### Edge Cases
- A phone call interrupts step 5: she leaves the composer and comes back → "You have an unsent reply to this email. Continue draft" (STORY-INB-013).

### Redundancy Candidates (this area)

- **Four ways to ask "what needs my reply?"**: the **Needs reply** group (`Inbox.tsx:843-852`), the **Important** toggle (`Inbox.tsx:612-622`), the **To do** card, and the Inbox agent. They overlap but give different lists (Needs reply is the cache window; Important adds priority and marked senders).
- **Two intros in the Inbox agent panel**: `AgentPanelIntro` (description plus two chips) and `InboxAgentIntro` (what it does plus three chips), both rendered for an empty thread (`Shell.tsx:4416-4427`, `Shell.tsx:3097-3103`).
- **Three search entry points**: the Inbox search box, "Search older mail", and the sidebar's "Search chats" box with its Mail row.
- **Three ways to send a reply**: the reply composer, the agent's approval card, and "Open in composer" after a failed card.
- **Two "important" notions**: the app's **Important** toggle and Mark important (star) on a row versus Gmail's own Important label (hidden from the menu when sorting is on, `Inbox.tsx:650-652`).
- **Two Archive paths with different feedback**: list/dialog archive shows "Archived · Undo"; the email-card dialog archives silently (`EmailCards.tsx:117-122`).

### Suspected problems (this area)

1. **Two stacked intros in the Inbox agent panel.** `AgentPanelIntro` shows description "Searches your connected mail." plus the chips "What needs a reply from me today?" and "Summarize this week's investor email" (`Shell.tsx:4416-4427`, `Shell.tsx:2700-2703`); `InboxAgentIntro` then shows "I read your mail, find what needs a reply and write replies…" with three different chips (`Shell.tsx:3097-3103`, `InboxAgentIntro.tsx`). Both conditions are true for an empty thread. Found by reading; not yet seen in a browser. The agent description "Searches your connected mail." (`inbox-agent.ts:28`) is also out of date: the agent now writes and sends replies.
2. **The Inbox does not update while it is open.** The sync runs once per visit (`Inbox.tsx:263-282`), the sidebar unread count refreshes only on mount and after Inbox actions (`Shell.tsx:654-661`), and no new-mail notification exists in the web app. A founder waiting for an investor's reply sees nothing change.
3. **Reconnect notice has no way to reconnect.** `Inbox.tsx:737-744` shows only **Try again**, which re-runs the same failing sync. A **Reconnect** link to the Gmail page is what STORY-INB-017 needs; PR #109's Data room dialog does offer one (`ImportFromEmail.tsx` on `origin/feat/legal`).
4. **Hide amounts leaves amounts visible in the Inbox list, the dialog title and the agent's email cards.** Only the message body, earlier-message lines and the sandboxed HTML are masked (`InboxMessageDialog.tsx:353, 534`, `SandboxedHtmlViewer.tsx:62-74`); `InboxRow.tsx:175-176`, `InboxMessageDialog.tsx:210` and `EmailCards.tsx:99-104` render raw text. The setting's helper text does not mention email.
5. **Agent card never says "Sent" after an unedited approval.** The header stays "Approved to send" (`MailApprovalCard.tsx:211-215`); "Sent by you" is only set on the edited-and-sent path (`mail-approval-edit.ts` header comment). Two end states for the same action.
6. **Archiving from an email card has no Undo** (`EmailCards.tsx:117-122`), while the same action in the list does.
7. **`e` in an open message ends reading.** It archives and closes the dialog (`Inbox.tsx:917-925`), so keyboard users do not move to the next message as in Gmail.
8. **"Mark noise" / "Mark important" in the More menu (phones, touch) lack the "all mail from {sender}" hint** that the hover tooltip has (`InboxRow.tsx:104-107` vs `268-277`); on touch screens there is no tooltip, so the sender-level effect is only explained by the toast after the fact.
9. **Conversation count understates old threads.** The "N messages" heading counts only cached messages (up to 50, 14-day window; `inbox.ts:547-558`), and earlier messages show no attachments (`InboxMessageDialog.tsx:510-565`). Maya cannot reach the term sheet's first attachment from the thread view.
10. **Archive / Mark read missing when a message is opened from outside the visible list** (a to-do for an archived mail, a deep link, a filter that hides it): `onArchive`/`onRead` depend on the row being in the list (`Inbox.tsx:917-926`).
11. **Forward with oversize attachments drops all of them silently except one red line** that can be overwritten by "Draft saved" (`inbox-compose.ts:127-138`, `ComposeEmail.tsx:257, 322-326`). The compose limit is 10 MB total while download allows 25 MiB.
12. **Keyboard help is not discoverable.** `?` works only on the list (`inbox-keyboard.ts:90-93`); the message dialog and composer show no hints for `r`, `a`, `f`, `e`, `j`, `k`, and Cmd+Enter (`ComposeEmail.tsx:544-549`) is not listed anywhere.
13. **Compose icon on phones has no visible label** and a greyed pen (no mail connected) gives no reason (`Inbox.tsx:695-711`).
14. **Account tab is not remembered or in the URL** (`Inbox.tsx:117`), and rows in the All tab do not show which account they belong to.
15. **Data room cannot take an email attachment on `main`**; filing needs download plus re-upload (STORY-INB-016). PR #109 adds an Import from email dialog on the Data room page only, not an action inside the email.
