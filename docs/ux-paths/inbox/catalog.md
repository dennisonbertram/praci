## Area: Inbox (STORY-INB-nnn)


Generated: 2026-10-17, refreshed 2026-10-20
Code read: `the repository root` at `559a76ad` (branch `docs/ux-pass`, merged with current `origin/main`). PR #109 (`origin/feat/legal`) was read with `git show` for the Data room import only; it is not part of this commit.
Total Stories: 61 (short 32, medium 23, long 6) as of 2026-10-20
Previous catalog: 2026-10-16, 24 stories (STORY-INB-001..024). This version keeps every id, rewrites the steps to match the code as it is now, and adds STORY-INB-025..040.

**Persona for every story.** A naive first-time user: a startup founder who has never seen Praci or its code, does not know its words ("triage", "noise", "agent", "Data room", "approval"), and only wants to run their company clearly and consistently. In the stories they are called **Maya**, the founder of the mock company. Steps say what Maya would try, in her words, and mark **Hesitation** where she would likely pause or misread a label. "UNVERIFIED" marks a behaviour read from code but not seen running; the walker should record what actually appears.

**Scope note on the Data room (written 2026-10-17, superseded: see the Refresh 2026-10-20 block).** On that commit the Data room had **no** "Import from email" and the Inbox has no "Save to Data room" action; the agent has only `data_room_search` and `data_room_read` (`builtin-tools.ts:1021-1028`), no tool that adds files. The way to file a mail attachment is: download it, then **Choose files** on the Data room page or drop it on any app page (STORY-INB-016, 022, 024). **PR #109 (`origin/feat/legal`)** adds `ImportFromEmail.tsx` to the Data room page (a button "Import from email", or "Connect Gmail" when none is connected, that opens a picker of mail with attachments). The main-branch path stays the primary path in every story; each Data-room story says what changes once #109 merges.

---

### Refresh 2026-10-20 (features merged since 2026-10-17)

- **Added** (21): INB-101, INB-102, INB-103, INB-104, INB-105, INB-106, INB-107, INB-108, INB-109, INB-110, INB-111, INB-112, INB-113, INB-114, INB-115, INB-116, INB-117, INB-118, INB-119, INB-120, INB-121. They sit at the end of this area under "Stories: Added 2026-10-20".
- **Rewritten in place for the current UI** (same id, new text, marked "Updated 2026-10-20"): INB-007, INB-025, INB-016.
- **Detail folded into an existing story** (same id, a section "Added 2026-10-20" at the end): INB-015, INB-018.
- **Marked with a dated note** (the UI changed; the steps below the note are the old steps and were not rewritten): INB-005, INB-014, INB-021, INB-022, INB-030, INB-031, INB-040, INB-001, INB-019, INB-017.
- The earlier scope note about the Data room (no 'Import from email', no 'Save to Data room', agent cannot add files) no longer holds. PR #109 and later work merged: attachment chips have 'Add to Data room', new mail attachments can be filed automatically, and the Data room has an Import menu. Treat any remark below that says "on main there is no import" as out of date; the current flow is in STORY-INB-016 and the new attachment stories.

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

> **Updated 2026-10-20**: the Integrations card for Gmail and the sidebar 'Connect apps' pill are covered in STORY-APP-378 and STORY-APP-380.

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

#### STORY-INB-002: "Let Praci sort your mail" — allow AI sorting

**Type**: short
**Topic**: Triage consent
**Persona**: Maya, cautious about investor email going to an AI provider
**Goal**: Decide whether to let the app sort her mail.
**Preconditions**: A1 connected; CONSENT-PENDING; SYNC-OK; messages M1–M11.
**Ideal path**: 2 — read the card, click Allow.
**Alternate paths**: Account menu → Settings → "AI data sharing" has one switch per model (`AccountSettingsOverlay.tsx:139`, `AiDataSharing.tsx:99-153`); STORY-INB-026 covers turning it off.

##### Steps
1. Opens Inbox → rows appear in two groups, **Today** and **Earlier**. No "Needs reply" group, no **Important** toggle, no To do card, no Categories in the Filter menu.
2. At the top a card (`AiDataSharing.tsx:69-96`): "**Let Praci sort your mail**" — "Praci finds what needs a reply, lists your to-dos and groups mail like bills and newsletters. Senders, recipients, subjects and short previews are sent to the AI service that runs your bots ({model name})." Buttons **Allow** and **Not now**. She **expects** a clear yes/no and that "no" leaves her mail alone. **Hesitation**: "the AI service that runs your bots" — she has no bots yet and does not know who that is; the provider name in brackets helps only if she recognises it. The card says the previews go out but not that the full email bodies are not.
3. Clicks **Allow** → the card is replaced by "Sorting your mail…" (STORY-INB-025), then the **Needs reply** group, **Important** toggle and **To do** card appear.

##### Variations
- She clicks **Not now** → the card disappears for this visit only (`Inbox.tsx:157, 794-802`); it returns on the next visit. Nothing is stored.
- She ignores the card: the list works as a plain mail list.
- She searches or filters first: the card is hidden while a search or filter or Important view is active (`Inbox.tsx:792`).

##### Edge Cases
- **Allow** fails (offline) → the card shows a red error line and **Allow** is enabled again (`AiDataSharing.tsx:50-54`).

#### STORY-INB-025: Maya waits through "Sorting your mail…" on a fresh account

> **Updated 2026-10-20**: rewritten for the current UI; the sorting states now have their own wording ('Sorting your mail...', 'Sorting is taking longer than usual. Your mail is below.' with 'Try sorting again').

**Type**: short
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, new to Praci, web, just connected Gmail and allowed AI data sharing.
**Goal**: Know whether the Inbox is broken or still working.
**Preconditions**: First sync just finished; the model is still classifying; Important pile open.
**Ideal path**: 1 — read the status line and wait.
**Alternate paths**: If sorting stalls, "Try sorting again".
##### Steps
1. Open Inbox → under the tabs a spinner and "Sorting your mail…" appear on the Important pile; the mail is listed below it.
2. Wait → the status line goes away and "Needs reply" / "Today" sections and the to-do card (if any) fill in.
3. If it takes too long, the line changes to "Sorting is taking longer than usual. Your mail is below." with a "Try sorting again" button; Maya clicks it → the status returns to "Sorting your mail…".
##### Variations
- Consent not yet given: instead of the status line, the Important pile shows the consent prompt ("Let Praci sort your mail" with Allow / Not now). After Allow, the status line takes the prompt's place at the same height so the page does not jump. After "Not now" the prompt hides for this visit. 
- The status shows only on the Important pile; Updates, Newsletters and Spam never show it.
##### Edge Cases
- Maya thinks: "Is my mail missing?" The words "Your mail is below" are only in the stalled version.
- The same sorting state also governs whether Needs reply exists; if she gives up and browses Updates, those mails may still shift pile once sorted. UNVERIFIED.

---

#### STORY-INB-026: Change her mind — turn AI sorting off in Settings

**Type**: short
**Topic**: Consent withdrawal
**Persona**: Maya, after reading an article about AI and email
**Goal**: Stop Praci sending her mail details to the AI service.
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

> **Updated 2026-10-20**: rows now sit in pile tabs and sender groups; 'Mark noise: all mail from {sender}' still exists on the row, and the learned pile can be forgotten in Cleanup (STORY-INB-102, STORY-INB-107). Re-walk with the Important pile as the starting view.

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

#### STORY-INB-007: Maya finds out why her Inbox opens on "Important" and what the other tabs hold

> **Updated 2026-10-20**: rewritten for the current UI; the Important toggle button no longer exists. The Inbox opens on the Important pile tab (with Updates, Newsletters and Spam beside it), and the Filter menu has no Important item while sorting is on.

**Type**: short
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, first-time founder of Northwind Robotics, on the web app, Gmail connected two days ago, mail sorting allowed.
**Goal**: Understand the four pile tabs and see where a vendor receipt and a newsletter went.
**Preconditions**: One Gmail account (maya@northwind.example) synced; triage finished. Mail exists in all piles; at least 3 spam messages.
**Ideal path**: 3 — open Inbox, click Updates, click Newsletters.
**Alternate paths**: Deep link `/app/inbox?pile=newsletters`; Filter menu > Categories > Newsletters (a different view: it clears the pile tab selection, so no tab is highlighted). Command palette "search mail" does not show piles.
##### Steps
1. Click "Inbox" in the sidebar PAGES group → Inbox opens on the Important tab (selected), URL has no `pile` param. Sections read "Needs reply", "Today" (or "Other mail today" when Needs reply is shown) and "Earlier".
2. Click the "Updates" tab → URL gains `?pile=updates`. Receipts and alerts from e.g. billing@payments.example.test are grouped by sender, each group showing the sender, a count and the newest subject.
3. Click the "Newsletters" tab → Newsletter senders (e.g. weekly@robotics-digest.example.test) appear grouped the same way, and a newspaper icon (aria "Digest") appears to the right of the tabs.
4. Notice the "Spam 3" tab at the end → it exists only because the count is above 0.
##### Variations
- Maya has two Gmail accounts: a second row of account tabs ("All" plus one per account) appears under the pile tabs; the pile and the account choice combine.
- Triage is off (no model or no consent): the Important pile has no "Needs reply" and the Filter menu gains an "Important" item. UNVERIFIED whether the pile tabs themselves still show with triage off; the code renders them whenever an account exists.
##### Edge Cases
- Maya thinks: "Where did the receipt go? It is not in Important." She hesitates because nothing says Updates is where receipts live. The only hint is the tab name.
- Opening a Filter or search clears the pile selection; no tab is highlighted until she clicks one. The same mail can be reached from the pile tab, the Filter menu (Categories) and `from:` search.

---

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

> **Updated 2026-10-20**: the Inbox opens on the Important pile; the To do card stays above the list. Re-walk to confirm its position.

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

> **Updated 2026-10-20**: detail added from a newer walk of the same goal, see the section "Added 2026-10-20" at the end of this story.

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

##### Added 2026-10-20: Preview a PDF attachment from an email, then download it

**Type**: short
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Read a supplier quote that arrived as a PDF without leaving the Inbox, then keep a copy on her laptop.
**Preconditions**: Gmail connected. Inbox contains "Quote NR-2041" from `sales@vendor.example.test` with `quote-nr-2041.pdf` (180 KB) attached.
**Ideal path**: 3 — click the chip, read, click Download.
**Alternate paths**: Chip three-dot menu then "Download" (skips the preview and shows "Downloaded quote-nr-2041.pdf" under the chips).
###### Steps
1. In Inbox, click the "Quote NR-2041" row → the email dialog opens; below the body is an "Attachments" list with a chip `quote-nr-2041.pdf 180 KB` (exact size text from `formatBytes`, UNVERIFIED format).
2. Click the chip → a large preview dialog opens titled with the filename; a grey pulsing block shows while the file loads, then the PDF renders. Maya thinks: "Good, it did not mark anything or leave the app." The fetch does not mark the message read (code comment says nothing is marked read).
3. Click "Download" in the preview toolbar → the browser saves `quote-nr-2041.pdf`. In the preview dialog no confirmation text is shown (the status line is in the email dialog behind).
4. Press Escape → returns to the email; the line under the chips reads "Downloaded quote-nr-2041.pdf".
###### Variations
- Narrow phone-width window: the buttons show only icons ("Download", "Add to Data room" are still the accessible names).
- Maya uses the three-dot menu instead and never sees the preview.
###### Edge Cases
- Hesitation: the "Downloaded" line appears only after closing the preview, so she may wonder if the click worked. UNVERIFIED whether the browser's own download bar covers this.
- If the download fails the line reads "Couldn't download quote-nr-2041.pdf" in red with an alert role.

#### STORY-INB-016: File one attachment to the Data room by hand and see "Added"

> **Updated 2026-10-20**: rewritten for the current UI; Praci now has an 'Add to Data room' action on every attachment chip, so there is no download-and-upload detour. The earlier text said the Data room could not take an attachment from the Inbox.

**Type**: medium
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Keep the signed NDA from an email in the Data room so her agents can find it, then confirm it is there.
**Preconditions**: Auto-filing is turned off (see STORY-INB-114) or the mail is older than 2 days. Email "Signed NDA" from `legal@partner.example.test` with `nda-signed.pdf` (240 KB).
**Ideal path**: 3 — open the email, open the chip menu, click "Add to Data room".
**Alternate paths**: Preview toolbar button "Add to Data room"; the Data room page's Import menu → Email (covered by the data-room topic, not repeated here); an agent calling `add_to_data_room`.
##### Steps
1. Open the "Signed NDA" email → chips shown.
2. Click the three-dot button "More actions for nda-signed.pdf" → menu with "Download" and "Add to Data room".
3. Click "Add to Data room" → the item is disabled while it files; then the menu item reads "Added" and is disabled. The Data room's import-progress watcher is told an import started.
4. Click the chip to preview → toolbar button also reads "Added" (disabled), matching the menu. Same state on two surfaces.
5. Open Data room in the sidebar → the file `nda-signed.pdf` is present; it may show processing first (see the Data room uploads topic).
##### Variations
- Close the email and reopen it later: the page asks the server which attachments of this message are already imported (`emailImported`), so the buttons still read "Added".
- File a second attachment of the same email: each is tracked separately.
##### Edge Cases
- Double-click: only one request is sent because the id is recorded synchronously.
- Same file previously filed (for example by auto-filing): the server reports a duplicate and the button still goes to "Added" because imported + duplicates is not zero.
- Failure (for example a Data room error): the button returns to "Add to Data room" and a red alert line shows under the chips, with the error text from the server. Which folder the file lands in is UNVERIFIED from this code.

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

> **Updated 2026-10-20**: the Inbox notice for rate limits is separate from the reconnect notice; see STORY-INB-018 and STORY-INB-119.

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

> **Updated 2026-10-20**: detail added from a newer walk of the same goal, see the section "Added 2026-10-20" at the end of this story.

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

##### Added 2026-10-20: Gmail rate-limits the sync and Maya sees a notice

**Type**: short
**Topic**: Gmail rate-limit notice
**Persona**: Maya, first-time founder at Northwind Robotics, opening her Inbox while Gmail is throttling her account
**Goal**: Understand why her mail is not showing and what to do.
**Preconditions**: Demo stack running; signed in; the space "Mail rate-limited" selected (account "Busy mail", always 429, empty cache).
**Ideal path**: 1 — read the notice and press **Try again** once (STORY-INB-119); nothing else is needed.
**Alternate paths**: A populated inbox with a throttled account shows the same text as a red line above the rows with a small **Try again** button (not walkable on the demo stack; see the top of this file). Searching while throttled (`searchMail`) also reports the account as rate limited.

###### Steps
1. Switches to the space "Mail rate-limited" in the space switcher, then clicks **Inbox** → `/app/inbox`. While the first sync runs, the page shows its loading state (UNVERIFIED: how long; the API call `inbox.refresh` runs first, then the list reloads).
2. The sync fails with a 429; `inboxList` returns the account under `failedAccounts` and `rateLimitedAccounts` → because there are no rows, the page shows a full-page empty state with a mail-warning icon, the title "**Your mail didn't load**", the line "**Gmail is limiting requests right now. Try again in a minute.**" (`syncErrorText`), and a **Try again** button. She does not see **Reconnect Gmail**, because the error is not a sign-in problem. **Hesitation**: "in a minute" is not exact (the server pauses the account for 30 seconds), and the title says "didn't load" without saying the cause; the cause is only in the line below.
3. Looks for what is broken in her account → nothing else on the page changes; the filter, search and pen icon (Compose) stay as they were for an account without mail (UNVERIFIED: whether Compose is enabled with a throttled account).

###### Variations
- Reconnect error and rate limit at once, on two accounts: only "Gmail needs to be reconnected." shows (`inbox-sync-error.ts`).
- Any other failure: "Couldn't reach Gmail." and the same **Try again** button.
- With a cache but no live data (not walkable on the demo stack): "Your mail didn't load" is replaced by the red alert line above the old rows, with the same text and a small outline **Try again**.

###### Edge Cases
- She leaves and comes back: the notice shows again on open, because the list API still reports the account while its 30-second pause is active or the last sync ended in a rate-limit error.
- The notice has no countdown, so she cannot tell when pressing **Try again** will do anything; STORY-INB-119 covers what happens if she presses it early.

---

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

> **Updated 2026-10-20**: the message dialog now has an 'Ask agent' button that opens one agent per thread (STORY-INB-112, STORY-INB-113, STORY-INB-117). The Inbox agent panel steps below are unchanged.

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

> **Updated 2026-10-20**: the keyboard shortcut set was not re-verified; pile tabs and Cleanup add new tab stops (STORY-INB-007, STORY-INB-104).

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

> **Updated 2026-10-20**: the phone Inbox has pile tabs and a Cleanup screen (STORY-INB-108). Re-walk the phone layout.

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
- She taps **Ask** → the agent panel opens over the page, up to 384 px wide; the collapse icon closes it (see the Inbox "Suspected problems").
- She rotates to landscape (width above 768 px) → the layout becomes the desktop one with columns.

##### Edge Cases
- Taps on the small pen icon, X and chevrons are enlarged on touch screens (`pointer-coarse:` classes).
- The pen icon has no text label on a phone; the tooltip needs hover.

### Stories: Accounts

#### STORY-INB-021: Two inboxes, one morning

> **Updated 2026-10-20**: each inbox now opens on the Important pile with pile tabs (Important, Updates, Newsletters, Spam). Re-walk the account switch with that in mind (STORY-INB-007).

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

> **Updated 2026-10-20**: the first morning now includes the Important pile tab, Digest and Cleanup (STORY-INB-007, STORY-INB-101, STORY-INB-104). Step wording about 'Needs reply' groups holds only inside the Important pile.

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
3. Reads the "Let Praci sort your mail" card → clicks **Allow** (STORY-INB-002) → "Sorting your mail…" (STORY-INB-025).
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

> **Updated 2026-10-20**: the phone Monday catch-up should start in the Important pile and can use Cleanup (STORY-INB-108).

**Type**: long
**Topic**: End-to-end (phone width, triage, agent, send)
**Persona**: Maya, in a taxi, 15 minutes before the board meeting
**Goal**: See what is urgent, answer Luis, send the board prep reply to everyone, clear junk, and ask the agent about the invoice.
**Preconditions**: Viewport 390 × 844, touch; A1; CONSENT-GIVEN; M1–M11; AGENT-READY; saved panel preference "open" from her desktop (so the phone-start rule can be seen).
**Ideal path**: 16.
**Alternate paths**: use the Inbox agent for steps 4–10 (STORY-INB-019/020).

##### Steps
1. Opens the app on the phone and taps **Inbox** in the menu. The unread count is visible beside the name. The agent panel is closed even though she left it open on the desktop (see the Inbox "Suspected problems").
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

### Stories: Added 2026-10-20, Inbox piles, Digest and Cleanup

#### STORY-INB-101: Maya reads the week's newsletters as a Digest and archives them all

**Type**: short
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, Northwind Robotics founder, web, Monday morning.
**Goal**: Skim the week's newsletters in one place and clear them.
**Preconditions**: Newsletters pile has 9 messages from the last 7 days and 6 older ones; Digest off.
**Ideal path**: 3 — Newsletters tab, Digest toggle, "Archive all".
**Alternate paths**: Expand each sender group and archive per group (the Archive icon on the group header); tick rows and use the selection bar's Archive. Mobile: the Digest option in the Inbox pile menu then an "Archive all" alert (UNVERIFIED exact control; code in `apps/mobile/app/inbox.tsx`).
##### Steps
1. Click the "Newsletters" tab → grouped sender list.
2. Click the newspaper icon (aria "Digest") → the list becomes cards, newest first, only the 9 messages from the last 7 days. Each card: sender, time, subject, a one-line summary (the model's reason, else the snippet), and an "Open" button.
3. Click "Open" on one card, "Robotics Weekly #212" → the message dialog opens. She reads it and closes it.
4. Click the archive icon (aria and tooltip "Archive all") above the cards → the 9 cards disappear and a toast reads "Archived 9" with Undo.
5. Click the Digest toggle again → back to the grouped list, which still holds the 6 older messages.
##### Variations
- Click Undo on the toast → the 9 return. If she waits too long, the toast goes away (Undo from here is gone; the Cleanup History does not list these, since this is a hand-picked archive; UNVERIFIED whether the Inbox archive is logged in History).
- Switching to Updates and back to Newsletters turns Digest off (it ends when another pile opens).
##### Edge Cases
- "Archive all" archives every card shown, not the whole pile. Maya may expect the 6 older ones to go too; the toast count (9) is the only signal.
- Hide amounts on: dollar figures in subjects and summaries are masked in the cards.
- A pile with nothing in the last 7 days shows only "No mail" with no toggle hint.
- Maya hesitates: "Archive all" has no confirmation, so she relies on Undo.

#### STORY-INB-102: Expand a noisy sender and archive just that group

**Type**: short
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: A solo technical founder (Dev) at Northwind Robotics, web, keyboard user.
**Goal**: Clear 14 build-notification emails from one sender without touching other Updates mail.
**Preconditions**: Updates pile contains 14 messages from ci@buildbot.example.test and 5 other single messages.
**Ideal path**: 2 — hover the group, click its Archive icon.
**Alternate paths**: Select the group's checkbox ("Select") then the selection bar's Archive; focus the group header with j/k and press e.
##### Steps
1. Open the Updates tab → one group row "buildbot" with count 14, and 5 ordinary rows (single-message senders show as plain rows, not groups).
2. Click the group header → it expands (chevron rotates, `aria-expanded=true`) and the 14 messages show indented.
3. Collapse it again, hover the header and click the Archive icon (tooltip "Archive") → toast "Archived 14" with Undo; the group leaves the list.
##### Variations
- Tick the group's checkbox (aria "Select"): checking some of the children shows it as indeterminate; the selection bar reads "N selected".
- Touch screen: the Archive icon is always visible on the group (`pointer-coarse`).
##### Edge Cases
- Keyboard: the header has its own id (`group:<key>`), j/k can land on it, Enter toggles it, x selects it.
- A group with one message is not a group, so there is no count or chevron; Maya might look for a chevron that is not there.
- Archive moves only inbox mail; messages already archived in the group are not counted. UNVERIFIED how the count handles mixed archived/inbox rows (`archivableIds`).

#### STORY-INB-103: Select several rows across a pile and move them to Spam, then undo

**Type**: medium
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, Northwind Robotics founder, web.
**Goal**: Mark three suspicious "invoice" emails as spam together, then recover one that was real.
**Preconditions**: Important pile has 3 emails from "Accounts Dept" at *.example.test addresses with a "Suspicious" icon on one; the Spam tab is not shown yet if the spam count is 0.
**Ideal path**: 5 — tick three rows, click Spam, read toast, open Spam tab, tick the real one, click Not spam.
**Alternate paths**: Per-row More menu > Spam (single); Cleanup > More > "Spam N" by sender (see story 7); toast Undo reverses the whole batch.
##### Steps
1. Hover the first row and tick its checkbox (aria "Select") → a selection bar appears at the top of the list: "1 selected", Archive, a shield icon (aria "Spam"), a trash icon (aria "Trash"), Clear.
2. Shift-click the third row's checkbox → rows 1-3 are ticked, bar reads "3 selected".
3. Click the shield icon (aria and title "Spam") → the rows leave the list at once, toast "Marked 3 as spam" with Undo. The tab strip gains "Spam 3".
4. Click the "Spam" tab → the three mails show with a Junk or Spam badge. The bar's shield now says "Not spam".
5. Tick the real invoice and click the shield (title "Not spam") → toast "Marked 1 as not spam"; the Spam count drops to 2.
6. Click the Important tab → the invoice is back and stays out of Spam (not spam is sticky).
##### Variations
- Click Undo in step 3 instead → all three return, Spam tab disappears when count hits 0 (unless it is the open pile).
- Choose the trash icon instead → "Moved 3 to trash".
- Press Clear → ticks are removed with no change.
##### Edge Cases
- If one message fails: error line "Couldn't archive 1" (reused wording even for spam/trash) and the list reloads to show what really happened.
- Maya hesitates between Spam and Trash: Spam teaches the sender's reputation; Trash does not. UNVERIFIED whether the UI says so (it does not).
- The Spam tab disappears if she is on another pile and the count reaches 0; if she is on Spam when it reaches 0 the tab stays so the open tab never vanishes.
- The same actions appear in the row's More menu (Spam, Trash, Not spam) and on the sender's Cleanup row, so one decision can be made from three surfaces.

#### STORY-INB-104: First Cleanup pass: archive the preselected bulk senders

**Type**: medium
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, Northwind Robotics founder, web, 2,000-message inbox, never opened most promotions.
**Goal**: Clear out bulk senders in one action.
**Preconditions**: One Gmail account; sender stats built; five senders qualify for preselection (3+ messages, under 20% read, never written to, not marked important).
**Ideal path**: 4 — open Cleanup, review ticks, click "Archive N", read toast.
**Alternate paths**: Per-group archive in the pile tabs (story 3); selection bar after ticking rows (story 4); the Inbox agent via "Ask" (not covered here).
##### Steps
1. Click the Cleanup icon (aria and title "Cleanup") in the Inbox header → page "Cleanup" with a Back arrow, then a loading skeleton, then a list of senders ranked by most unopened mail. Five rows are already ticked.
2. Read a row: "Loop Hardware Deals · deals@loophw.example.test", right side "42 · 0% read · Oct 18". Maya hesitates at the one she half-remembers buying from and unticks "Select Loop Hardware Deals".
3. Look at the action bar → "Archive 31", "Unsubscribe 29", "Skip inbox 31", and a More button. The numbers count conversations in the inbox for the ticked senders, not messages.
4. Click "Archive 31" → the button shows a spinner and all controls wait; then a toast "Archived 31" with Undo (10 seconds). The list reloads and the archived senders usually drop off because they no longer have inbox mail.
5. A History section appears at the bottom: "Archived 31 · Meridian Promos +3" with a time and Undo.
6. Click the Back arrow → the Inbox returns, unread count in the sidebar is refreshed.
##### Variations
- Nothing qualifies: nothing is ticked, the bar buttons show 0 and are disabled until she ticks rows by hand.
- No senders at all: "Nothing to clean up", no bar.
- Two accounts: each row also shows the account label.
##### Edge Cases
- Archive keeps working in pages of 50 conversations per sender; a large sender may take a few seconds. If a page stops with mail remaining, the row reports "Couldn't update {name}" under the list.
- Archive does not unsubscribe, so new mail from the same sender will return to the inbox. That is the reason the other two buttons exist; Maya may not realise this.
- Browser Back from Cleanup returns to the Inbox because cleanup is a URL state (`?cleanup=1`) of the same route.
- Same info on multiple surfaces: "N% read" and the message count also reflect what the pile tabs hold for that sender; the Updates/Newsletters group count is mail in the window, the Cleanup count is conversations in the inbox. These can differ.

#### STORY-INB-105: Unsubscribe from a newsletter by mailto and by link

**Type**: medium
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, Northwind Robotics founder, web.
**Goal**: Stop two newsletters for good, and see what happens when the sender needs an email or a web page.
**Preconditions**: Cleanup lists "Robotics Weekly" (unsubscribe by mailto to unsubscribe@robotics-digest.example.test) and "Sensor Deals" (a web unsubscribe link). A third sender, "Parcel Alerts", has no unsubscribe method.
**Ideal path**: 6 — tick two senders, click "Unsubscribe N", confirm Send, click Open link, read toast.
**Alternate paths**: Open the newsletter and use its own unsubscribe link outside Praci; Skip inbox (story 8) when Maya only wants quiet, not removal.
##### Steps
1. Open Cleanup and tick "Select Robotics Weekly", "Select Sensor Deals" and "Select Parcel Alerts" → "Unsubscribe N" counts only the first two (senders with no method are left out of that count).
2. Click "Unsubscribe N" → for the mailto sender the app stops with a dialog "Send an unsubscribe email to unsubscribe@robotics-digest.example.test?" with Cancel and Send.
3. Click Send → the email is sent for her and the sender's mail is archived. 
4. For the link sender a line appears under the list: "Sensor Deals" with an "Open link" button (opens in a new tab). Maya clicks "Open link" → the sender's own page loads where she may need to press a final button. 
5. A toast reads "Unsubscribed from 2" with Undo; History adds "Unsubscribed and archived N".
##### Variations
- Click Cancel on the dialog → nothing is sent and that sender is skipped for this run (neither unsubscribed nor archived).
- Several mailto senders: the dialog appears for each in turn.
- The unsubscribe fails: line "Couldn't unsubscribe from Sensor Deals", plus an "Open link" if the server has a page to try by hand.
- Mobile: the same confirmation is a native alert "Send an unsubscribe email to {address}?" with Cancel / Send, and the choice is first confirmed by an alert titled like the button (e.g. "Unsubscribe 29").
##### Edge Cases
- Maya hesitates at the mailto dialog: it says only the address, not that her own Gmail will send it; the mail goes from her account. UNVERIFIED what the server uses to send.
- Mail-writes switched off on the server (`mailWritesDisabled`): the call fails with "Changing mail is turned off." and shows as a failure line. 
- Undo from the toast reverses the archive, not the unsubscribe request already sent. UNVERIFIED in UI; History Undo works on archive batches only.
- A "Looks like spam" sender is not unsubscribed from; the server refuses ("This sender looks like spam.") so sending an unsubscribe request to a spammer is avoided.

#### STORY-INB-106: Skip inbox for a sender, see the Gmail filter note, and stop it later

**Type**: medium
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, Northwind Robotics founder, web, wants her investor-update list "out of sight but kept".
**Goal**: Keep a sender's mail out of the inbox from now on without unsubscribing, then reverse that.
**Preconditions**: One Gmail account without the Gmail "make filters" permission; the sender "Fund Updates" (updates@fund.example.test) sends monthly.
**Ideal path**: 6 — tick sender, "Skip inbox N", read row state, later click "Stop".
**Alternate paths**: Unsubscribe (story 7) removes the mail at the source; Archive (story 6) does it once only; Mark noise on a row (More/hover action "Mark noise: all mail from {sender}") treats mail from the sender as noise in Praci only.
##### Steps
1. In Cleanup, tick "Select Fund Updates" and click "Skip inbox 3" → the sender's current inbox mail is archived and a decision is recorded; mail that arrives later is archived by sync. A toast reads "Skipping inbox for 1 sender" with Undo.
2. The row stays listed (even with nothing left to archive) with the label "Skipping" and a "Stop" link, so the decision can be undone.
3. Because Gmail has not allowed filters yet, an "Also in Gmail" link appears under the action bar (account label first when there are several accounts). Maya hesitates: it does not say what it does. Clicking it starts a Google sign-in to grant permission.
4. After granting, she clicks "Skip inbox" again for the sender if the row shows "Couldn't add Gmail filter" → the filter is retried. If it shows "Gmail filter limit reached", no new Gmail filter can be made; the skip still works inside Praci.
5. Weeks later, Maya opens Cleanup, finds the row with "Skipping" and clicks "Stop" → the decision (and the Gmail filter if one was made) is forgotten and the row loses its label.
##### Variations
- Select a "Looks like spam" sender: "Skip inbox N" does not count it; the server also refuses it.
- History records "Skipped inbox for N" with a "Skip inbox" reason tag shown only when it differs from the action name.
##### Edge Cases
- Mail Maya sees arrive in Gmail's own app is archived by the Gmail filter, but in Praci only by sync; the two are different mechanisms. UNVERIFIED timing.
- Undo on the toast removes the skip for the sender: UNVERIFIED whether History Undo also removes the Gmail filter.
- "Stop" fails: an error line (red) above the list; the list reloads either way.

#### STORY-INB-107: Undo a Cleanup from History, and forget a learned pile

**Type**: medium
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, Northwind Robotics founder, web. She archived a sender last week and now needs its mail back.
**Goal**: Restore archived mail from History, and correct Praci's guess that "Jordan at Pacific Supply" is a newsletter.
**Preconditions**: History holds "Archived 12 · Pacific Supply Co." (source manual) and an "Unsubscribed and archived 8 · Robotics Weekly +1 · Automatic". Pacific Supply has the label "Learned Newsletters".
**Ideal path**: 4 — open Cleanup, Undo the action, Forget the learned pile, check Inbox.
**Alternate paths**: Undo from the 10-second toast right after the action; the Inbox "Moved ... to Inbox" Undo. Mark important on a row sets the pile too (explicit marks override learning).
##### Steps
1. Open Cleanup and scroll to the History heading → list of actions, newest first, each with a time and an Undo button.
2. Click Undo on "Archived 12 · Pacific Supply Co." → the button waits; the 12 conversations return to the inbox and the sidebar unread count refreshes. The row's Undo is disabled once the action is undone.
3. On the Pacific Supply row, read "Learned Newsletters" with a "Forget" link next to it → click Forget. The label goes away.
4. Click Back and open the Newsletters tab → Pacific Supply mail is judged by the rules again (no learned pile). It may sit under Important or Updates on the next sync. UNVERIFIED whether pile membership changes immediately or after the next sync (`applyPileRules` runs on sync).
##### Variations
- The "Automatic" tag marks an action done by the system on Maya's earlier choice (for example mail archived by a Skip inbox decision when it arrived). Maya can undo these too.
- Undo fails: a red error line above the list.
##### Edge Cases
- Unsubscribe actions' Undo brings the mail back but does not re-subscribe her.
- Where Maya looks for recent actions: History exists only on the Cleanup screen. The Inbox toasts for hand-picked archives have no History equivalent. UNVERIFIED which Inbox bulk actions are logged (spam/trash batches are undone by batch id, so they are logged).
- The History list names only the first sender and "+N" for the rest; Maya cannot see all senders of a batch without opening the Inbox.

#### STORY-INB-108: Cleanup on the phone

**Type**: medium
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, Northwind Robotics founder, Expo mobile app on iPhone, waiting in a queue.
**Goal**: Archive and unsubscribe from bulk senders using the phone.
**Preconditions**: iOS 26 (native header menu) or earlier (fallback button); Gmail connected; same senders as story 6.
**Ideal path**: 5 — open Cleanup, adjust ticks, choose action from the header menu, confirm alert, read result.
**Alternate paths**: Do it on the web (stories 6-8). Phone has no Skip-inbox Gmail-permission link in the code read (UNVERIFIED).
##### Steps
1. In the Inbox screen, open the header menu and choose "Cleanup" (icon: checklist) → the Cleanup screen shows sender rows; preselected ones are ticked.
2. Read a row: "Meridian Promos", "42 messages · 0% read · Oct 18", and notes "Looks like spam", "Skipping" + "Stop", "Learned Newsletters" + "Forget".
3. Open the header menu again → "Archive 31", "Unsubscribe 29", "Skip inbox 31", "Spam 2" (counts as on web).
4. Tap "Archive 31" → a native alert titled "Archive 31" with Cancel and "Archive 31". Maya confirms.
5. See the result: the list reloads. Failures appear in the list as "Could not update {name}" with "Open link" when a page is available.
6. Tap a History item → alert with the action line (for example "Archive · 12 · Pacific Supply Co.") with Cancel / Undo.
##### Variations
- Load failure: "Could not load senders" with a "Retry" button. Empty: "Nothing to clean up".
- Mobile pile picker: Important, Updates, Newsletters, Spam (behind its count) in the Inbox; Newsletters has a digest option with "Archive all" in an alert.
##### Edge Cases
- Wording differs from web: "Could not update {name}" (phone) vs "Couldn't update {name}" (web); "Could not load senders" vs "Couldn't load senders". The same screen on two surfaces; a UX catalog should list both.
- There is no 10-second Undo toast on phone; Undo lives in History only. UNVERIFIED; no toast code was seen in `inbox-cleanup.tsx`.

#### STORY-INB-109: A Monday-morning inbox reset across piles, Digest, Cleanup and Spam

**Type**: long
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, first-time founder of Northwind Robotics, web, first real session after a week away; 340 unread. Gmail account maya@northwind.example, triage on.
**Goal**: Get to a manageable Important pile, make newsletters a one-minute read, stop three recurring senders, and recover one mistake.
**Preconditions**: Mail sorted; Newsletters has 12 recent issues; Cleanup has 6 preselected senders; Spam holds 4 messages, one of them a real customer's reply.
**Ideal path**: 24 — a long journey with natural backtracking; no shortcut covers all of it.
**Alternate paths**: Ask the Inbox agent to tidy ("Ask"); use only the Filter menu (Unread, Categories); keep a single large Cleanup pass (story 6).
##### Steps
1. Click "Inbox" → Important pile; she sees "Needs reply" (2), "Today" ("Other mail today"), "Earlier". Status line "Sorting your mail…" shows briefly and clears.
2. Open the first Needs reply email → the message dialog opens (prev/next, Reply, Archive). She replies later and closes the dialog → the list is unchanged.
3. Click the "Spam 4" tab → four mails with Junk/Spam badges. Maya spots "Alex, Brightline Customer" asking about an order.
4. Tick that row (aria "Select") → bar shows "1 selected" with a shield (title "Not spam"). Click it → toast "Marked 1 as not spam", count becomes "Spam 3".
5. Tick the other three and click Trash (aria "Trash") → toast "Moved 3 to trash"; the Spam tab remains because it is the open pile.
6. Click the "Important" tab → the customer's email is back in Important and stays (not spam is sticky).
7. Click the "Newsletters" tab → groups by sender; she notes 5 groups with counts.
8. Click the newspaper icon (aria "Digest") → 12 cards from the last 7 days. She reads three summaries and clicks "Open" on one, "Robotics Weekly #212", then closes it.
9. Click the archive icon "Archive all" → "Archived 12", then clicks the Digest toggle off. 
10. Click the Cleanup icon in the header (title "Cleanup") → skeleton, then the sender list. Six are preselected.
11. Untick "Select Loop Hardware Deals" (she buys from them) → action counts drop.
12. Tick "Select Fund Updates" (investor newsletter she wants kept but quiet).
13. Click "Archive 31" for the ticked set → toast "Archived 31"; History shows a new row.
14. Re-tick only "Fund Updates", click "Skip inbox 3" → toast "Skipping inbox for 1 sender"; the row shows "Skipping" with "Stop".
15. Tick "Robotics Weekly" and "Sensor Deals"; click "Unsubscribe 2" → the dialog "Send an unsubscribe email to unsubscribe@robotics-digest.example.test?" appears; click Send.
16. Under the list, "Sensor Deals" with "Open link" appears; click it → the sender's page opens in a new tab; she completes it there and returns.
17. Toast "Unsubscribed from 2". She realises she wanted Sensor Deals' discount codes; scrolls to History.
18. Click Undo on "Unsubscribed and archived ..." → mail returns to the inbox (the unsubscribe request already sent is not reversed).
19. Click the Back arrow → Inbox; the sidebar unread count has dropped from 340.
20. Click the "Updates" tab → groups; expands "buildbot" (14), collapses it, hovers and clicks Archive → "Archived 14".
21. She leaves the toast alone; after 10 seconds it goes away and the group stays archived.
22. Open Filter menu > Unread → the pile tabs deselect and a "results" strip with "Clear" appears; she scans unread items and clicks "Clear" → back to the pile.
23. Click "Important" → a short list. She is done.
##### Variations
- Do the Cleanup pass first, then the piles; History then also shows the pile actions that were logged.
- If sync is still running or the sort is stalled, steps 1 and 7-9 change; see story 5.
##### Edge Cases
- Maya hesitates at step 15: nothing in the dialog says it sends from her own address. 
- The same mailbox state is reflected in five places: the sidebar unread badge, the pile counts (Spam only), the Cleanup rows, History, and the Inbox lists. After each action only some update at once; the others update on reload.
- Browser Back at step 19-20 returns to the Inbox from Cleanup because it is a URL state, but a refresh keeps `?cleanup=1`.
- Hide amounts: any amount in a Digest card is masked.

#### STORY-INB-110: Cleanup when Gmail needs permission, mail changes are off, or there is nothing to do

**Type**: short
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: The deployment owner on the desktop app, running Praci on a local stack with mail writes disabled for safety.
**Goal**: See what Cleanup does when it cannot change mail.
**Preconditions**: `mailWritesDisabled` is on for this deployment (operator setting, name from code); Gmail connected read-only.
**Ideal path**: 3 — open Cleanup, tick a sender, click Archive and read the error.
**Alternate paths**: Re-enable mail writes (operator setting; outside the UI).
##### Steps
1. Open Cleanup from the Inbox header → senders list loads normally (reading is allowed).
2. Tick one sender and click "Archive N" → the call fails with "Changing mail is turned off." 
3. The error shows as a line "Couldn't update {sender name}" under the list and, because the screen already has data, an extra red line above it; no toast, no History row. 
##### Variations
- Load fails altogether (Gmail down): a "Couldn't load senders" alert with "Try again" instead of the list.
- No senders: "Nothing to clean up" and no action bar.
- Gmail rate limit or sign-out at the Inbox level: see the existing Gmail rate-limit topic (`new-gmail-rate-limit.md`); not repeated here.
##### Edge Cases
- The Archive button looks active until clicked; the setting is not shown in the UI before the error. UNVERIFIED whether another place tells the owner mail writes are off.
- Duplicate failure text: the same failure shows on the sender line and in a red banner, so it can read as two errors.

### Stories: Added 2026-10-20, Mail attachments, Ask agent and auto-filing

#### STORY-INB-111: Step through several attachments with the arrows and keyboard

**Type**: short
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Review three attachments (invoice PDF, cost spreadsheet, site photo) of one email in a row.
**Preconditions**: Email "Pilot order paperwork" from `ops@customer.example.test` has `invoice.pdf`, `costs.xlsx`, `site.jpg` (90 KB).
**Ideal path**: 4 — open the first chip, press the right arrow twice, Escape.
**Alternate paths**: "Next attachment" and "Previous attachment" buttons in the preview toolbar do the same as ArrowRight/ArrowLeft.
##### Steps
1. Click the `invoice.pdf` chip → preview opens on index 0; "Previous attachment" is disabled.
2. Press ArrowRight → `costs.xlsx` loads in the spreadsheet preview (rendered by the server-backed sheet viewer).
3. Press ArrowRight → `site.jpg` shows as an image. "Next attachment" is now disabled.
4. Press the letter `e` or `r` → nothing happens: the preview stops key events so the email's Archive and Reply shortcuts do not fire.
5. Press Escape → back to the email, still open.
##### Variations
- The image chip shows a 20 px thumbnail instead of a generic icon because the file is under 512 KB.
- Large photo (over 10 MB): preview says "Too large to preview" but Download still works.
##### Edge Cases
- A `.docx` in the set shows "Preview isn't available for this file type — download it to view it."
- With "hide amounts" turned on, PDF, image, HTML and sheet previews show "Hidden while amounts are hidden"; text and Markdown still show. Maya may think the file is broken.

#### STORY-INB-112: Ask agent about an email thread for the first time

**Type**: medium
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Get a summary of a long thread with a contract manufacturer and a draft reply.
**Preconditions**: Gmail connected, inbox page open. Thread "Re: Fwd: Pilot build schedule" with 6 messages from `priya@factory.example.test`. Mail AI data sharing already allowed for the model.
**Ideal path**: 4 — open the email, click "Ask agent", type the question, send.
**Alternate paths**: Mobile message screen has the same action in its header (UNVERIFIED label). Ask the Inbox agent instead (less focused; no thread seeded).
##### Steps
1. Open the thread's newest message → toolbar shows "Reply", "Reply all", "Forward", "Archive", "Mark read"/"Mark unread" and "Ask agent" (Bot icon).
2. Click "Ask agent" → the button disables while the agent is created, then the dialog closes into a new chat. The agent is named from the subject with "Re:" and "Fwd:" removed: "Pilot build schedule". Composer is focused.
3. Look at the transcript → the first item is a collapsed card "Email thread · 6 messages". Maya thinks: "Is it going to read all this without asking me?" Nothing has run yet.
4. Click the card → it expands to the messages (sender, date, text, and a paperclip line with attachment filenames).
5. Type "Summarize where the schedule stands and draft a reply asking for a revised date" and send → the agent answers from the thread. The agent can only draft: a reply uses `mail_send` and shows an approval card to approve, edit or discard.
6. The sidebar lists the new agent; it notifies on finish.
##### Variations
- Thread longer than 30 messages: only the newest 30 are seeded (older ones are readable by the agent through `mail_get`).
- A message that fails to load from Gmail falls back to its cached preview, unless it is the one Maya opened, which must load or the click shows an error.
##### Edge Cases
- Attachments appear as filenames only; the agent does not receive their content. UNVERIFIED whether it can open them with other tools.
- The agent cannot archive or change mail (stated in its instructions).

#### STORY-INB-113: Ask agent when mail AI data sharing is not yet allowed

**Type**: medium
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Find out why the thread agent says it cannot see the email, and fix it.
**Preconditions**: New account; mail AI data sharing for the chosen model not allowed yet. Email "Term sheet draft" from `partner@fund.example.test`.
**Ideal path**: 5 — Ask agent, send, see consent card, Allow, resend.
**Alternate paths**: AI data sharing switches in account Settings (covered by the account-data topic).
##### Steps
1. Open the email, click "Ask agent" → new chat "Term sheet draft" with collapsed "Email thread · 3 messages" card.
2. Maya sends "What are the key terms?" → the agent's history holds only a placeholder instead of the thread (text says the thread is not shared yet and to allow AI data sharing in Settings). The agent tells her to allow it and does not ask her to paste the email.
3. When the agent tries to read mail, the existing consent card appears with "Allow" and "Not now" (exact wording from the AskCard topic). She hesitates: "I only wanted this one email."
4. Click "Allow" → the thread now reaches the model on the next run.
5. Send the question again → the agent answers using the thread.
##### Variations
- "Not now" → the agent keeps the placeholder; denying does not loop.
- Mail consent is per model, and the thread agent runs on the Inbox agent's model override if one exists, so allowing it on the Inbox card already covers this chat.
##### Edge Cases
- The seeded card in the transcript is visible to Maya even though the model has not seen it. Same information in two states, which can confuse. UNVERIFIED whether any extra UI explains this.

#### STORY-INB-114: Turn automatic filing off and on in Model settings

**Type**: short
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Solo technical founder who keeps client contracts out of shared storage
**Goal**: Stop new attachments from being filed without asking.
**Preconditions**: Signed in; never touched the setting (so it is on).
**Ideal path**: 3 — open Model settings, clear the checkbox, check the result.
**Alternate paths**: none found (no setting on the Data room page itself in the code read).
##### Steps
1. Open the Model settings overlay → near the top, under the model row and the "Data room search model" disclosure, a checkbox "Add email attachments to the Data room" is checked. It is disabled for a moment until the saved value loads.
2. Clear the checkbox → saved immediately on change; no Save button, no toast.
3. Close and reopen the overlay → checkbox is still cleared.
4. Check it again → saved the same way.
##### Variations
- A new account with no stored row sees it checked (default on).
##### Edge Cases
- Save fails: red alert "Could not save the setting" (or the server's message) appears below, and the checkbox keeps the old value. UNVERIFIED because `setEnabled` only runs after success.
- Turning it on later does not file mail already in the cache (code comment).
- The setting is per member, not per workspace.

#### STORY-INB-115: An invoice arrives and lands in the Data room automatically

**Type**: medium
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: See that a customer's purchase order filed itself without a click.
**Preconditions**: Setting on. Gmail synced. A new email from `buyer@customer.example.test` arrives with `PO-8812.pdf` (95 KB), no unsubscribe header.
**Ideal path**: 3 — wait for sync, open the email, see "Added".
**Alternate paths**: Open the Data room and look for the file.
##### Steps
1. The mail sync stores the new message; because it is new and recent, a `mail.attachments` job is queued.
2. Maya opens the email from the Inbox → chip `PO-8812.pdf` appears. Opening the chip menu shows "Added" (disabled) rather than "Add to Data room", because the dialog asks the server which files are already imported.
3. Click the chip, then the preview toolbar → "Added" there too.
4. Open Data room → the file is listed, going through the normal processing steps. She thinks: "I never asked for that. Where do I turn it off?" (see STORY-INB-114). Which folder it lands in is UNVERIFIED.
##### Variations
- The email is from yourself to a client with an attached Excel file: filed too, since mail the owner sent to others counts.
- Zip attachments are filed and then unpacked by the zip import.
##### Edge Cases
- No consent is needed for storing the file; sending content to a model still needs consent.
- Race: if Maya opens the email within seconds, the chip may still say "Add to Data room". Clicking it is safe: the server reports a duplicate and the button goes to "Added".

#### STORY-INB-116: Mail that does not get auto-filed

**Type**: medium
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Solo technical founder
**Goal**: Understand why a few attachments never reached the Data room.
**Preconditions**: Setting on. Inbox holds (a) newsletter PDF from `news@digest.example.test` with unsubscribe link, (b) `logo.png` 4 KB in a signature, (c) `.docx` from `noreply@billing.example.test`, (d) a 4-day-old email with `contract.pdf` that arrived during first sync.
**Ideal path**: 4 — inspect each email's chips and menus.
**Alternate paths**: Add each wanted file by hand (STORY-INB-016).
##### Steps
1. Open (a) → chip is present; menu shows "Add to Data room" (not "Added") because bulk and List-Unsubscribe mail is skipped.
2. Open (b) → image inline in signature is not a chip as an attachment, or if it is, it shows "Add to Data room" because it is under 10 KB and not a document type.
3. Open (c) → no-reply senders are skipped; "Add to Data room" is still available.
4. Open (d) → older than 2 days at sync time; not filed.
5. Click "Add to Data room" on (d) → "Added".
##### Variations
- A PDF sent by an unusual client labelled `application/octet-stream` is still filed when its extension is pdf, doc, docx, xls, xlsx, csv, pptx or zip.
##### Edge Cases
- There is no visible reason on screen for a skipped file. Maya must infer it. The manual button is the only recovery.
- Manual add accepts files the auto rules skip, but the Data room may still refuse non-documents. UNVERIFIED which messages appear for a refused type.

#### STORY-INB-117: Reopen the same thread agent and handle an unsent reply and a missing email

**Type**: medium
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Come back to the same thread agent the next day, and see how the dialog behaves when the email has gone.
**Preconditions**: STORY-INB-112 completed. Maya started a reply earlier and closed the composer without sending.
**Ideal path**: 4 — open the email, read the banner, click "Ask agent" again.
**Alternate paths**: Find the agent in the sidebar by its name.
##### Steps
1. Open the same email → toolbar appears; below it a status line "You have an unsent reply to this email." with a "Continue draft" link.
2. Click "Continue draft" → the composer opens (the email dialog hides behind it) with the saved reply.
3. Close the composer → the banner returns, because the draft is kept.
4. Click "Ask agent" → no new agent: the same chat opens (one agent per account and thread), with the earlier conversation. Maya thinks: "Good, it didn't start over." A newer message in the thread is not added to the seeded card. UNVERIFIED whether the card refreshes.
5. Later, delete the email in Gmail and open a stale link to it → the dialog title is "Email not found", with "This email isn't in your mail any more. It may have been deleted or moved." and a "Back to Inbox" button.
##### Variations
- While loading, the dialog shows the sender, date and snippet from the list row, a skeleton toolbar and a white skeleton body.
- Load error shows red text and "Try again" instead.
##### Edge Cases
- If Ask agent fails (Gmail error on the opened message), a red alert line appears under the toolbar and the button re-enables.
- Archived agents are ignored and a new one is created. UNVERIFIED in the UI.

#### STORY-INB-118: From a vendor email to a filed document and an agent answer

**Type**: long
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Maya, first-time founder of Northwind Robotics, new to Praci
**Goal**: Receive a contract revision, check it, file it, and have an agent compare it with what she asked for, end to end.
**Preconditions**: Gmail connected; Model settings reachable; auto-filing off (she turned it off in STORY-INB-114); mail AI data sharing not yet allowed; email "Supply agreement v3" from `priya@factory.example.test` with `supply-agreement-v3.pdf` (1.2 MB) and `pricing.xlsx` (60 KB); thread has 4 earlier messages.
**Ideal path**: 12 — open email, preview both, file the PDF, ask agent, allow sharing, ask question, read result, check Data room.
**Alternate paths**: Skip the manual filing and let auto-filing do it (setting on); ask the Inbox agent instead of a thread agent.
##### Steps
1. Sidebar → Inbox; click the "Supply agreement v3" row → dialog opens with the loading skeleton, then the body; the thread above shows "4 earlier messages" as a collapsed list.
2. Click one earlier row in the thread list ("You" rows have a Sent mark) → its text expands under the row.
3. Scroll to the attachment chips; click `supply-agreement-v3.pdf` → PDF preview.
4. Press ArrowRight → `pricing.xlsx` shows in the sheet viewer with tabs.
5. Press ArrowLeft, then click "Add to Data room" in the toolbar → button disables, then reads "Added".
6. Escape back to the email. Maya thinks: "Do I also want the spreadsheet in there?" Opens the three-dot menu for `pricing.xlsx` → "Add to Data room" → "Added".
7. Click "Ask agent" → chat "Supply agreement v3" opens; the card "Email thread · 5 messages" is collapsed.
8. Send "Did Priya change the payment terms from v2?" → the agent replies it cannot see the thread because AI data sharing is not allowed for mail, and points at Settings.
9. The consent card appears when it reads mail; click "Allow".
10. Send the question again → the agent summarizes the changes, naming the attachment files from the thread card (names only).
11. Ask "Draft a reply asking for net 45" → a reply approval card appears; Maya edits and approves, or discards. Nothing is sent without her.
12. Open Data room in the sidebar → both files are present. Optionally use the Data room agent ("Ask", covered in the Data room topics) to ask about the PDF contents, which the thread agent could not read.
##### Variations
- With auto-filing on, step 5 and 6 are unnecessary and both buttons already read "Added" on opening.
- On phone: the same actions are on the mobile message screen (UNVERIFIED layout).
##### Edge Cases
- Two surfaces say the same thing: "Added" in the chip menu and in the preview toolbar; the filename list in the thread card and the chips.
- Hesitation points: whether Ask agent reads attachments (it does not, by name only), whether Allow covers all mail (it is per model), and whether the filed document is searchable yet (processing may still be running).
- If the email is deleted mid-journey, step 7 returns an error line under the toolbar.

### Stories: Added 2026-10-20, Gmail rate-limit notice

#### STORY-INB-119: Maya presses "Try again" during the pause

**Type**: short
**Topic**: Try again during a rate-limit pause
**Persona**: Maya, impatient, presses the button right after she sees the notice
**Goal**: Get her mail to load now.
**Preconditions**: As STORY-INB-018, immediately after the notice appeared (less than 30 seconds since the last failed sync).
**Ideal path**: 1 — one click, then wait.
**Alternate paths**: Switch to another tab and back to the Inbox tab: a visibility change re-runs the sync without a click (`Inbox.tsx`, around line 203). The page also looks for new mail about once a minute (`NEW_MAIL_POLL_MS`).

##### Steps
1. Clicks **Try again** within a few seconds of the notice → the button text becomes "**Trying again…**" and is disabled (`retrying` is true until the sync call answers). The notice stays on screen.
2. Waits → the API (`inboxRefresh` → `waitOutBackoff`) reads the remaining pause from the database clock. If 30 seconds or less remain, it waits until the pause ends (plus 50 ms), then runs the sync. Maya sees only "Trying again…" for up to about 30 seconds. **Hesitation**: nothing says it is waiting for Gmail's pause; she may think the page is frozen.
3. The sync runs. On the demo stack Gmail still answers 429 → "Trying again…" returns to **Try again**, and the same "Gmail is limiting requests right now. Try again in a minute." text shows. A new 30-second pause starts. She cannot tell that the retry ran, except that the button was busy.
4. On a Gmail that has recovered (not walkable on the demo stack) → the notice goes, rows load, and the sidebar unread count refreshes (`onRefreshed`).

##### Variations
- She clicks **Try again** several times in a row: the button is disabled while the sync runs, so extra clicks do nothing (UNVERIFIED).
- She clicks after the pause has already ended: no wait; the sync runs at once.
- She leaves the page while "Trying again…" shows: the wait stops (the request is aborted) and no sync runs.

##### Edge Cases
- If more than 30 seconds remain (only possible if the pause was set longer than 30 seconds), `waitOutBackoff` does not wait, the sync is skipped as inside the pause, and the notice returns at once with no retry.
- A retry with two accounts: each account waits out its own pause, at most four at a time. A slow second account keeps "Trying again…" on screen after the first has recovered (UNVERIFIED).

#### STORY-INB-120: The notice clears once the pause is over

**Type**: short
**Topic**: Rate-limit notice clearing
**Persona**: Maya, back from making coffee
**Goal**: See her mail again without doing anything special.
**Preconditions**: An account whose Gmail was throttled and has since recovered; at least 30 seconds since the last 429. **Not reachable on the unmodified demo stack** (its throttled account never recovers). Needs a `failNext(429, ...)` hook, or read `apps/api/src/inbox.postgres.test.ts`.
**Ideal path**: 1 — open or return to the Inbox tab and the notice is gone.
**Alternate paths**: Press **Try again** (STORY-INB-119).

##### Steps
1. Returns to the Inbox tab after more than 30 seconds → the tab becoming visible re-runs the sync (`setAttempt`). The sync is no longer inside the pause and goes to Gmail.
2. Gmail answers normally → the sync clears the error and the pause (`lastErrorAt = NULL`, `backoffUntil = NULL`, `mail-sync.ts`); the list reloads with her mail and no notice.
3. If she only reloaded the list without a sync: `inboxList` keeps a rate-limited account in `failedAccounts` only while its `backoffUntil` is in the future, so once the 30 seconds have passed the notice also stops showing on the next list read, even before a successful sync (`inbox.ts`, the `current` filter). A reconnect error is different: it stays until fixed.

##### Variations
- Within the 30 seconds: the notice still shows after returning to the tab; the sync is skipped.
- Gmail throttles again on the first sync after the pause: the notice returns and a new 30-second pause starts.

##### Edge Cases
- The notice disappears with no confirmation. She may not notice that mail refreshed.
- After a long outage with a stale cache, the rows she sees may be old until the sync completes (UNVERIFIED).

#### STORY-INB-121: Maya taps Reply while Gmail is failing

**Type**: short
**Topic**: Reply fallback composer
**Persona**: Maya, replying to an email from Luis Romero while Gmail is throttling or down
**Goal**: Start a reply even though Gmail will not return the full message.
**Preconditions**: A message M3 (Luis Romero, received, not sent by Maya) is in the cache; the inbox row is visible; Gmail now answers 429 (or fails) for the single-message fetch. **Not reachable on the unmodified demo stack** (the throttled space has no cached mail; the other spaces never fail). Covered by Vitest cases in `apps/api/src/inbox-compose.postgres.test.ts`.
**Ideal path**: 3 — open the message, click Reply, then fill To herself.
**Alternate paths**: Forward (the same fallback; the body is empty and no attachments are carried); Reply all; reply from a row's quick action (UNVERIFIED if one exists).

##### Steps
1. Opens M3 from the list → the preview comes from the cache. If the full message was not cached, the page shows the error "Gmail is busy. Try again in a moment." (`mailUnavailable`, status TOO_MANY_REQUESTS) instead of the body (UNVERIFIED which of these shows).
2. Clicks **Reply** → the composer opens anyway. The server could not fetch the original (`inboxComposePrefill` caught a rate-limit or outage error), so it built the reply from the cached copy and returned `quoteUnavailable: true`.
3. The composer shows the subject from the cache ("Re: Can we move Thursday's demo to Friday?"), an empty body with nothing quoted, and the red note "**The original message didn't load.**" (`ComposeEmail.tsx`). The note stays through autosave unless a different error takes its place.
4. Looks at **To** → it is empty (and Cc is empty), because the cache has no Reply-To header and the app will not guess the address. **Hesitation**: she expects Luis's address to be filled in and may not see why it is blank; the note does not mention To.
5. Types Luis's address, writes the reply and sends → the send path behaves as in a normal reply. If Gmail is still throttled, the send fails with "Gmail is limiting requests. Try again in a minute." (`problemText`) and the composer stays open with her text.

##### Variations
- Reply to her own sent message (the sent-mail variant): To is filled from the cached To list, because her own message answers to its recipients; the note still shows.
- Auth error instead of a rate limit: no fallback; the composer gives a reconnect error (the API throws PRECONDITION_FAILED).
- Message deleted in Gmail (not found): no fallback; the error is a not-found message.
- Reply all or Forward: same note; Forward also has no attachments.

##### Edge Cases
- She closes and reopens Reply after Gmail recovers: the prefill runs again and quotes the original normally (UNVERIFIED that the earlier draft is kept).
- Replies sent in this state carry no quote, so the recipient sees no earlier text.
- Gmail's own threading still applies, because `replyToMessageId` is sent (UNVERIFIED in the Gmail emulator).

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


---
