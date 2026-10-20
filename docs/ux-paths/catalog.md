# UX Path Catalog: Praci first-time founder pass

Generated: 2026-10-17
Branch: docs/ux-pass (merged with origin/main at 559a76ad)
Total Stories: 308 (short 172, medium 104, long 32)
Sources: `docs/ux-paths/{inbox,finance,legal,captable,dataroom,app}/catalog.md`. This file merges them verbatim. The per-area files hold the same text; this file is the one `/ux-walker` and `/ux-flow` read.
Persona: a naive first-time founder (Maya, "Northwind Robotics") who has never seen the product and wants to run her company. Each story gives the steps she tries, the outcome she would assume, and where she would hesitate.
Evidence: every area was written by reading code. No story was walked in a browser. Items the code alone cannot settle are marked UNVERIFIED in the stories.

The 2026-10-14 Inbox email audit (STORY-001..062) stays in `catalog-inbox-email-audit-2026-10-14.md`. "Prior STORY-nnn" references point to it, not to this file.

## Story ids

| Area | Prefix | short | medium | long | Total | Ids |
|---|---|---|---|---|---|---|
| Inbox | STORY-INB-nnn | 23 | 13 | 4 | 40 | 001-040 |
| Finance | STORY-FIN-nnn | 19 | 12 | 5 | 36 | 001-036 |
| Legal | STORY-LEG-nnn | 12 | 13 | 4 | 29 | 001-029 |
| Cap Table | STORY-CAP-nnn | 21 | 7 | 5 | 33 | 001-033 |
| Data room | STORY-DRM-nnn | 26 | 17 | 1 | 44 | 001-044 |
| App shell, settings, integrations, billing, journeys | STORY-APP-nnn | 71 | 42 | 13 | 126 | 001-025 (kept), 101-146 (shell A), 151-191 (chats, integrations, settings, B), 200-214 (cross-feature journeys) |
| **Total** | | **172** | **104** | **32** | **308** | |

Counts come from each story's **Type** field. Previous catalog (2026-10-16): 135 stories (INB 24, FIN 23, LEG 20, CAP 20, DRM 23, APP 25). All 135 ids are kept; none were dropped. The Changes section at the top of each area lists what was rewritten and added. Journeys: STORY-APP-024 (Monday morning) was rewritten as a journey; STORY-APP-175 is unused; 192-199 are spare.

## Walk blockers (read before walking)

- **Legal and Data room import are not in this checkout.** They merge from PR #109 (`origin/feat/legal`, read at f2b8fc1e). Every STORY-LEG story, STORY-DRM-020, 021, 023, 039-044 and journeys STORY-APP-200, 205, 206, 212, 214 (and the Legal part of 208) need a build that includes that branch. Run STORY-LEG-020 first.
- **Carta needs the real host.** The app recognizes Carta only at `mcp.app.carta.com`, so a mock server on another host will not count as Carta for the Cap Table stories.
- **Data room sharing does not exist** on main or on `feat/legal` (STORY-DRM-022 records the gap).
- **Overlap to know about:** STORY-APP-016 (part B, "when is Chief done") and STORY-APP-124..127 (part A, Activity and browser notifications) cover related notifications; walk both but expect shared findings.

---

## Area: Inbox (STORY-INB-nnn)

Source: `docs/ux-paths/inbox/catalog.md`.


Generated: 2026-10-17
Code read: `the repository root` at `559a76ad` (branch `docs/ux-pass`, merged with current `origin/main`). PR #109 (`origin/feat/legal`) was read with `git show` for the Data room import only; it is not part of this commit.
Total Stories: 40 (short 23, medium 13, long 4)
Previous catalog: 2026-10-16, 24 stories (STORY-INB-001..024). This version keeps every id, rewrites the steps to match the code as it is now, and adds STORY-INB-025..040.

**Persona for every story.** A naive first-time user: a startup founder who has never seen Praci or its code, does not know its words ("triage", "noise", "agent", "Data room", "approval"), and only wants to run their company clearly and consistently. In the stories they are called **Maya**, the founder of the mock company. Steps say what Maya would try, in her words, and mark **Hesitation** where she would likely pause or misread a label. "UNVERIFIED" marks a behaviour read from code but not seen running; the walker should record what actually appears.

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
- She taps **Ask** → the agent panel opens over the page, up to 384 px wide; the collapse icon closes it (see the Inbox "Suspected problems").
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

## Area: Finance (STORY-FIN-nnn)

Source: `docs/ux-paths/finance/catalog.md`.


Generated: 2026-10-17
Code read at: `559a76ad` (`the repository root`, branch `docs/ux-pass`), read-only.
Scope: `/app/finance/*` (dashboard and detail pages), the Add account dialog, statement upload,
crypto wallets and exchanges, finance tiles on `/app/integrations?category=finance`, the Finance
agent side panel, finance cards in chat, agent pins and checklists, and the **Hide amounts**
switch (Finance, Cap table, chat, search, notifications).
Total stories: 36 (short 19, medium 12, long 5)

### Changes since the 2026-10-16 catalog

Code changed a lot in the Finance pages since the earlier catalog (Hide amounts, an empty-state
rewrite, a shared "Ask" button, vendor grouping, statement review, a Blockscout key that is now
optional). All 23 earlier ids still apply; most had labels or steps fixed.

- **Kept unchanged in intent, steps fixed**: FIN-002, 003, 005, 008, 009, 010, 012, 013, 014, 015, 016, 020.
- **Changed (behaviour moved in code)**:
  - FIN-001: the empty state is now "No accounts yet" with logos, one **Add account** button; after
    the first source connects, only a small "Add Brex" link remains.
  - FIN-004: Monthly burn is now "3-mo avg, after revenue"; the Burn page has one KPI, not three.
  - FIN-006: Runway page now says "Revenue — Subtracted from burn" (it used to say Excluded).
  - FIN-007: the "Spend this month" KPI is gone; the period strip holds the total, and Breakdown now follows the tabs.
  - FIN-011: a `bill` row now opens a small details popover (it used to do nothing).
  - FIN-017, 018, 021: a statement whose balances do not add up now waits for **Import anyway** or **Discard**; past statements are listed in the dialog with **Remove**; a statement account can be renamed.
  - FIN-019, 022: the agent button is now "Ask" (aria-label "Ask Finance agent"); the empty panel offers two questions.
  - FIN-023: an unknown transaction id now shows "Not found"; an unknown `?source=` is flagged "Unknown source: chase ×".
- **Dropped**: none.
- **Added** (new behaviour):
  - FIN-024 to FIN-031: Hide amounts (header button, account-menu row, persistence, what is masked on Finance, Cap table, chat and charts, receipts, phone, keyboard, leaks).
  - FIN-032: group transactions by vendor ("By vendor").
  - FIN-033: Brex spend from the Burn page, and the source-filtered Accounts page.
  - FIN-034: rename a statement account.
  - FIN-035: wallets without a Blockscout key (optional key note).
  - FIN-036: long story that mixes Hide amounts with a board-call screen share.

### Persona (applies to every story)

A first-time user. Maya, a startup founder at "Northwind Robotics", has never seen
Praci or its code. She does not know its terms ("burn", "runway scope", "MCP", "Blockscout",
"pins", "Hide amounts"). She wants to run her company clearly and consistently: know how much money
she has, what she spends it on, and when it runs out. Steps are written in her words.
**Hesitation** marks a place where a first-timer is likely to stop, misread a label, or pick the
wrong control.

### Demo account (shared preconditions)

The walk runs against a seeded mock demo account. Every visible company, vendor, and person name
must be clearly fake. The baseline seed is called **NW-BASE**:

- Space or company name: `Northwind Robotics`. The signed-in user is the founder
  (for example `Mock Founder`). With more than one space, the space name shows beside the page title.
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
  - One transaction memo that contains a dollar amount, for example `Invoice 4417 — $4,200 deposit`.
- At least one transaction in a non-USD currency, so "1 non-USD not counted" shows in the header.
- Finance agent: **not created yet** in NW-BASE, so the first "Ask" creates it.
- Hide amounts: **off** (the default on a browser that never switched it).

Extra seeds named in story preconditions:

- **NW-CRYPTO**: NW-BASE plus one wallet `MOCK Treasury Safe` (type Safe, 2 of 3 owners) on
  Ethereum holding USDC and ETH; one wallet `mock-ops.eth` (type Personal) holding one unpriced
  token; a Coinbase exchange connection with USD, BTC and USDC balances; 90 days of crypto history.
  No Blockscout API key is saved unless a story says so. The runway scope is `bank`.
- **NW-STATEMENT**: NW-BASE plus one account created from an uploaded statement
  (`MOCK First Mock Bank ••5502`) whose next statement is due, so the reminder banner shows.
  Test files: `mock-firstbank-2026-09.csv` (balances match), `mock-firstbank-2026-08.pdf`
  (balances off by $12.40), `notes.docx` (wrong type), and one file over the size limit.
- **NW-EMPTY**: a fresh `Northwind Robotics` space with no finance sources, no
  statement accounts, no wallets and no exchanges.
- **NW-RECONNECT**: NW-BASE with the Mercury source set to `needs_reconnect`.
- **NW-AGENT**: NW-BASE plus an existing Finance agent whose thread holds one earlier turn with 3
  finance tool reads (overview, breakdown by vendor, subscriptions), so a collapsed
  "3 finance lookups" group shows. The agent also has pins: two stat pins
  ("Cash", "Runway") and one checklist ("Month-end close") with 3 items, one of them done.
- **NW-CAP**: NW-BASE plus a connected Carta account with a cap table snapshot (`MOCK Mock
  Founder`, 8,000,000 shares; `MOCK Seed Fund I`, 1,200,000 shares; an option pool), valued at
  a share price so dollar values and percentages show.
- **NW-HIDDEN**: NW-AGENT plus NW-CAP, with a chat thread where the agent has replied with text
  containing "$1.62M in cash" and "7.9 months of runway", and one chart message.

### Summary

| Type | Count |
|------|-------|
| Short | 19 |
| Medium | 12 |
| Long | 5 |

### Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Dashboard: Cash, Monthly burn, Runway, Crypto KPIs, refresh | 001, 002, 003, 019 | No "Spend this month" KPI any more; spend is in the period strip |
| Burn page, month page | 004, 005, 019 | — |
| Runway page, crypto scope | 006, 015, 020 | No "what if" scenario in the UI; only the agent can model one |
| Spend page, period tabs, category chips, chart-bar ranges | 007 | No search, no export |
| Breakdown by category or vendor, category and vendor pages | 008, 009 | — |
| Subscriptions, Upcoming, recurring page, bill popover | 010, 011 | No cancel, rename or "not a subscription" control |
| Transactions, receipts, group by vendor | 012, 013, 032 | No way to recategorize or add notes |
| Accounts list, source filter, account detail, cards owed | 014, 019, 033 | Account detail shows only the newest transactions; no "See more" |
| Crypto: wallets, exchanges, optional Blockscout key, Alchemy | 015, 016, 020, 035 | — |
| Statement upload, review, reminders, removal, rename | 017, 018, 021, 034 | — |
| Connecting Mercury and Brex, reconnecting | 001, 019, 022 | No disconnect in Finance |
| Finance agent panel, finance cards, Ask about this | 019, 020, 022 | — |
| Pins and checklists | 022 | Hidden in the Finance side panel |
| Hide amounts: switch, persistence, scope | 024, 025, 026, 027, 028, 029, 030, 031, 036 | No keyboard shortcut; no cross-tab sync; charts keep their shape |
| Errors, empty states, not found | 001, 013, 018, 023 | — |

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
├── STORY-FIN-032 (group by vendor)
├── STORY-FIN-014 → STORY-FIN-033 (accounts, card owed → Brex spend)
├── STORY-FIN-023 (wrong links, not found)
├── STORY-FIN-024 → STORY-FIN-025 → STORY-FIN-026 (Hide amounts: header, menu, persistence)
└── STORY-FIN-027 → STORY-FIN-028 (hidden dashboard → hidden detail pages)

NW-CRYPTO
├── STORY-FIN-015 (count crypto in runway)
├── STORY-FIN-016 (add, edit, remove wallet and exchange)
├── STORY-FIN-035 (wallets without a key)
└── STORY-FIN-020 (long: investor update with crypto)

NW-STATEMENT
├── STORY-FIN-017 (reminder → upload)
├── STORY-FIN-018 (bad files, review)
├── STORY-FIN-034 (rename a statement account)
└── STORY-FIN-021 (long: bank without an integration)

NW-RECONNECT + NW-AGENT
└── STORY-FIN-022 (long: monthly review with the agent, pins, reconnect)

NW-HIDDEN
├── STORY-FIN-029 (Cap table and chat while hidden)
├── STORY-FIN-030 (phone width)
├── STORY-FIN-031 (keyboard only)
└── STORY-FIN-036 (long: board-call screen share)
```


### Stories: First visit and connecting

#### STORY-FIN-001: Open Finance for the first time and connect the bank

**Type**: medium
**Topic**: Connecting
**Persona**: Maya, naive first-time founder
**Goal**: "I bank with Mercury. I want this app to show my cash."
**Preconditions**: NW-EMPTY. A Mercury OAuth sandbox or stub that completes sign-in for a mock
Mercury org with NW-BASE accounts.
**Ideal path**: 3 — click Finance, click Add account, click Mercury and approve the popup (the
approval is the third step).
**Alternate paths**: (a) Integrations page `/app/integrations?category=finance` → Mercury tile
"Connect" (`FinanceSection.tsx:446-463`); (b) Accounts page **Add account** (`FinanceAccounts.tsx:~228`), only
reachable later.

##### Steps
1. Click **Finance** in the left sidebar → `/app/finance` shows the title "Finance" and, under it, the
   Mercury and Brex logos, "No accounts yet", "Add an account to see cash, burn, runway and spend." and
   one button, **Add account** (`Finance.tsx:216-245`).
   - Hesitation: only bank logos are shown. A founder who also holds crypto or uses another bank does
     not know those are supported until the dialog opens.
2. Click **Add account** → dialog "Add account" with a **Bank** section (Mercury "Read balances and
   transactions", Brex "Read cards, expenses and bills", "Upload statements" "PDF, CSV, OFX or QFX") and
   a **Crypto** section (Wallet "Address or ENS", Coinbase and Kraken "Read-only API key")
   (`AddAccountDialog.tsx:121-205`).
3. Click **Mercury** → a sign-in popup opens. The Bank cards are disabled while it waits.
4. Approve access in the popup → the popup closes, the dialog closes, and the dashboard reloads.
5. Watch the header → "Syncing…" with a spinning refresh icon, and skeleton cards until the first
   sync finishes.
6. After the sync → KPI cards "Cash", "Monthly burn" and "Runway" show values, a period strip with
   the spend total, and a green-dot "Mercury" chip sits next to the title. Because Brex is the only
   source still missing, a small link **Add Brex** shows.

##### Variations
- Close the popup without approving → the dialog stays open with "Sign-in was cancelled or did not
  finish. Try again."
- Connect from Integrations instead → the tile changes to "Connected" with **Open Finance**.
- With two spaces, the space name shows in small grey text beside "Finance".

##### Edge Cases
- The first sync fails → a red notice with **Try again** shows above the cards.
- **Add Brex** goes to Integrations (`Finance.tsx:91`, `:410-416`), not to the Add account dialog where
  Mercury was connected. The founder connects two banks in two different places.

---

#### STORY-FIN-002: "How much cash do we have right now?"

**Type**: short
**Topic**: Dashboard
**Persona**: Maya, naive first-time founder
**Goal**: Read one trustworthy cash number and see what makes it up.
**Preconditions**: NW-BASE.
**Ideal path**: 1 — open Finance and read the Cash card.
**Alternate paths**: Accounts page "Total cash" KPI (`FinanceAccounts.tsx:~270`); Runway page "Cash"
KPI (`FinanceBurn.tsx:~249`); Finance agent overview card "Cash" (`FinanceCards.tsx:~121`).

##### Steps
1. Open **Finance** → the **Cash** card shows about $1,622,000 with the subtitle "3 bank accounts"
   (`cashSubtitle`, `ui.tsx:788`).
   - Hesitation: "3 bank accounts" does not name them. The founder has to open the card to see
     Checking, Treasury and Savings.
2. Notice the Brex card balance is not part of the number → no hint on the dashboard says card debt
   is excluded.
3. Click the **Cash** card → `/app/finance/accounts` shows "Total cash", "Card balance owed $38,500 —
   Not counted in cash", a "Total balance" chart with Week/Month/Quarter/Year tabs, and the list of
   cash accounts.

##### Variations
- Mobile width → the KPIs wrap into a 2-column grid; an odd last card takes the full row.

##### Edge Cases
- "1 non-USD not counted" shows in the header with no link or explanation of which transaction.
- Brex-only company → Cash and Runway cards are hidden (`Finance.tsx:~395`), with no message why.

---

#### STORY-FIN-003: Make sure the numbers are current

**Type**: short
**Topic**: Dashboard
**Persona**: Maya, naive first-time founder
**Goal**: "I just paid a contractor. Is that in here yet?"
**Preconditions**: NW-BASE, last sync about 2 hours ago (shows "Updated 2 hours ago").
**Ideal path**: 1 — click refresh.
**Alternate paths**: none found (opening Finance also triggers one sync per visit,
`Finance.tsx:140-152`).

##### Steps
1. Read the header → "Updated 2 hours ago" next to a small refresh icon with no text label.
   - Hesitation: the icon is tiny and only has an aria-label "Refresh" (and a tooltip on hover).
2. Click the refresh icon → it spins and the text changes to "Syncing…". The chips beside it do not
   move, because both labels share one grid cell.
3. Wait → the text changes to "Updated just now" (or similar) and the numbers reload. A fast,
   throttled refresh still holds "Syncing…" for about 0.8 seconds so the click shows something
   (`Finance.tsx:123`).

##### Edge Cases
- Sync service unavailable → a red notice with the error text and **Try again**.
- Keyboard: Tab to the refresh icon, press Enter; focus stays on it while it syncs
  (`focusableWhenDisabled`).

---

### Stories: Burn and runway

#### STORY-FIN-004: "What is our burn?"

**Type**: medium
**Topic**: Burn
**Persona**: Maya, naive first-time founder
**Goal**: Understand monthly burn and where it goes.
**Preconditions**: NW-BASE.
**Ideal path**: 2 — click Monthly burn, read the Burn page.
**Alternate paths**: dashboard "Burn ›" section title (`Finance.tsx:~496`); Runway page "Monthly
burn" KPI (`FinanceBurn.tsx:~250`).

##### Steps
1. On the dashboard, read **Monthly burn** → about $205,000 with the subtitle "3-mo avg, after
   revenue".
   - Hesitation: a founder may expect gross spend this month; the subtitle is the only hint that
     revenue is already taken off.
2. Look at the **Burn** chart → dark "Out", grey "Revenue", and striped "Financing" bars (Month tab
   is selected). The last bar has an asterisk and "* So far".
3. Click **Monthly burn** → `/app/finance/burn` shows one KPI "Monthly burn", a monthly bar chart
   starting at the first month with data, "Where it went" (a stacked bar and category rows with
   swatches), "By account" with percent shares, and "By month" (Month, Out, In, Net).
4. Read the **By month** table → Net is red when negative, green when positive. The financing month
   shows a large positive Net.
   - Hesitation: "Net" counts revenue and financing as "In", while the KPI above subtracts only
     revenue. The founder may not see why the numbers differ.

##### Variations
- Choose **Year** on the dashboard period tabs → the Burn chart changes to monthly bars; clicking one
  opens the month page.
- An account that took in more than it spent does not appear in "By account".

---

#### STORY-FIN-005: Drill into one month

**Type**: short
**Topic**: Burn
**Persona**: Maya, naive first-time founder
**Goal**: "Why was August so expensive?"
**Preconditions**: NW-BASE with a large one-off August charge (`MOCK Hardware Supplier`, $48,000).
**Ideal path**: 2 — open Burn, click August.
**Alternate paths**: dashboard Year tab → click the August bar (`Finance.tsx:~560`); Burn page chart
bar (`FinanceBurn.tsx:~104`).

##### Steps
1. On `/app/finance/burn`, click **August 2026** in By month → `/app/finance/month/2026-08` shows
   "Out", "In", "Net" KPIs, a Categories list, and Transactions (with **List** and **By vendor**
   buttons).
2. Find `MOCK Hardware Supplier` → it is at or near the top of Transactions.
3. Click the **← Burn** back button → returns to the Burn page.

##### Edge Cases
- `/app/finance/month/2026-8` (no leading zero) → "Not found" with "This page doesn't exist or was
  removed." and a **← Finance** back button.

---

#### STORY-FIN-006: "When do we run out of money?"

**Type**: short
**Topic**: Runway
**Persona**: Maya, naive first-time founder
**Goal**: Know the runway in months and the date.
**Preconditions**: NW-BASE.
**Ideal path**: 1 — read the Runway card.
**Alternate paths**: Runway page (`FinanceBurn.tsx:~228`); Finance agent overview card
(`FinanceCards.tsx:~122`).

##### Steps
1. Read **Runway** on the dashboard → for example "7.9 mo" and "Until May 2027".
2. Click it → `/app/finance/runway` shows Cash, Monthly burn, Runway, Run-out (a full date), a
   "Projected cash" line (solid for history, dashed for projection), and a list: "Burn — Spending minus
   revenue, 3-mo avg", "Revenue — Subtracted from burn", "Financing — Excluded", "Treasury yield —
   Excluded", "Card balance owed — Not counted" (`FinanceBurn.tsx:~319`).
   - Hesitation: "Financing — Excluded" may alarm a founder who just raised; the page does not say
     why a raise is not counted.

##### Edge Cases
- Brex-only company → Cash and Runway cards are hidden on the dashboard.

---

### Stories: Spend, categories, vendors

#### STORY-FIN-007: See everything we spent this quarter

**Type**: medium
**Topic**: Spend
**Persona**: Maya, naive first-time founder
**Goal**: "Show me every expense this quarter."
**Preconditions**: NW-BASE.
**Ideal path**: 2 — open Spend, choose Quarter.
**Alternate paths**: the large total next to the period tabs (`Finance.tsx:~452`); the "N transactions"
header of a chat transactions card (`FinanceCards.tsx:~180`).

##### Steps
1. On the dashboard choose **Quarter** in the period tabs → the total and "Spent <range> · ↑x% vs
   <range>" update (the comparison is left out when both figures are equal). The Burn chart switches to
   weekly bars and the Breakdown card follows the tab and shows the same date range.
   - Hesitation: Upcoming and Subscriptions do not change with the tabs. There is no "Spend this
     month" card to look for any more; the total is the bold figure beside the tabs.
2. Click the bold quarter total → `/app/finance/spend?period=quarter` shows the period tabs, the
   total, chips "All", then one chip per category, and the transaction table (Date, Counterparty,
   Category, Amount, Status) with **List** and **By vendor** buttons.
3. Click the **Software** chip → the URL gets `&cat=software` and the list narrows.
4. Look for a search box or an export button → none exists.

##### Variations
- From the dashboard Burn chart, click one day bar → `/app/finance/spend?period=month&from=…&to=…`
  shows that day only, no tab is selected, and a "Oct 3 ×" badge clears it.
- On that day view, click **Week** → the day range is dropped.

##### Edge Cases
- A category with no transactions in the period → "No transactions in this period".

---

#### STORY-FIN-008: "What are we spending the most on?"

**Type**: medium
**Topic**: Breakdown
**Persona**: Maya, naive first-time founder
**Goal**: Find the biggest category and the vendors inside it.
**Preconditions**: NW-BASE.
**Ideal path**: 2 — read Breakdown, click the top category.
**Alternate paths**: Burn page "Where it went" (`FinanceBurn.tsx:~115`); month page Categories; chat
breakdown card (`FinanceCards.tsx:~139`).

##### Steps
1. On the dashboard read **Breakdown** with **Category** selected → rows with bars, Payroll at the top.
2. Click **Show all 9** → all categories show. Click **Show less** → it collapses.
3. Click **Software** → `/app/finance/category/software` shows "Last 90 days" total, a small trend line
   with no axis, a Vendors list, and Recent transactions.
4. Check the breadcrumb → "Finance / Breakdown / Software". Click **← Breakdown** → the dashboard
   scrolls back to the Breakdown card (the URL has `#breakdown`) and keeps the Category or Vendor
   choice (`?by=vendor`).

---

#### STORY-FIN-009: Look at one vendor's history

**Type**: short
**Topic**: Vendor
**Persona**: Maya, naive first-time founder
**Goal**: "Has AWS been going up?"
**Preconditions**: NW-BASE with 6+ months of `MOCK AWS` charges rising.
**Ideal path**: 2 — Breakdown → Vendor → MOCK AWS.
**Alternate paths**: Subscriptions table row; category page Vendors list; transaction page "Merchant ›"
link; recurring page "Vendor ›" link; chat vendor breakdown card.

##### Steps
1. In Breakdown, click **Vendor**, then **MOCK AWS** → `/app/finance/vendor/<key>` shows "Monthly avg"
   (with "Last 6 full months"), "Change" (red when up, with "vs Apr"), "First seen", "Paid with", a
   Monthly spend bar chart (only from the first charge) and a Charges table with a Receipt column.
2. Read the breadcrumb → "Finance / Subscriptions / MOCK AWS" (because AWS is a subscription), or
   "Finance / Breakdown / …" for a non-subscription vendor.

---

### Stories: Subscriptions and upcoming

#### STORY-FIN-010: Find subscriptions to cancel

**Type**: medium
**Topic**: Subscriptions
**Persona**: Maya, naive first-time founder
**Goal**: "What SaaS are we paying for, and is anything redundant?"
**Preconditions**: NW-BASE including two subscriptions in the same overlap group.
**Ideal path**: 1 — read the Subscriptions table.
**Alternate paths**: chat subscriptions card (`FinanceCards.tsx:~205`), whose rows open the recurring
page instead of the vendor page.

##### Steps
1. Scroll to **Subscriptions** → a table with Vendor, Monthly, "3 mo" sparkline, Last charge, and a
   footer "5 subscriptions · $X/mo".
2. Notice the **overlaps** pill on two rows.
   - Hesitation: the pill does not say what the row overlaps with.
3. Hover or Tab to a row → a dark pill shows "Brex ••0001" (paid with); screen readers get it in the
   link's name ("MOCK Figma, paid with Brex ••0001").
4. Click a row → the vendor page opens.
5. Look for a Cancel or "mark as not a subscription" control → none exists. The founder must ask the
   agent or go to the vendor.

##### Variations
- Phone width → the "3 mo" and "Last charge" columns and the paid-with pill are hidden.

---

#### STORY-FIN-011: What bills are coming in the next 30 days?

**Type**: short
**Topic**: Upcoming
**Persona**: Maya, naive first-time founder
**Goal**: Plan cash for the next month.
**Preconditions**: NW-BASE with recurring, pending and bill items in the next 30 days.
**Ideal path**: 1 — read Upcoming.
**Alternate paths**: none found.

##### Steps
1. Read **Upcoming · 30 days** → a total "~$X", then rows of date(s), name, a tag (`recurring`,
   `pending` or `bill`), amount, and a chevron. Weekly items show "×4".
2. Click a `recurring` row → `/app/finance/recurring/<key>` shows Cadence, Next, Expected, Vendor ›,
   and Past charges.
3. Click a `pending` row → the transaction page opens.
4. Click a `bill` row → a small popover opens in place: the bill name, "Brex bill, not paid yet",
   Amount, Due (with "(overdue)" when past due) and Status (`Finance.tsx:~711-734`).
   - Hesitation: a bill has no page of its own and no link to pay it from here.

---

### Stories: Transactions and receipts

#### STORY-FIN-012: Check one charge and find its receipt

**Type**: medium
**Topic**: Transactions
**Persona**: Maya, naive first-time founder
**Goal**: "My accountant asks for the receipt for the Figma charge."
**Preconditions**: NW-BASE: a Brex `MOCK Figma` charge with `hasReceipt` and an image receipt.
**Ideal path**: 3 — find the charge, open it, open the receipt.
**Alternate paths**: vendor page Charges table (receipt icon column); Spend page; month page; category
Recent; account detail; chat transactions card rows.

##### Steps
1. Open **Breakdown → Vendor → MOCK Figma** → the Charges table shows a receipt icon on the row.
2. Click the row → the transaction page title is the counterparty ("MOCK Figma"); the amount is large;
   below are Merchant ›, Date, Status, Source "MOCK Brex Card ••0001", Cardholder, Category ›, Memo,
   and **Open in Brex** (`FinanceTransaction.tsx:~154-222`).
3. Click the receipt thumbnail → `/app/finance/receipt/<id>` shows the image and **Open receipt**.

##### Variations
- Wanting to change the category → no control exists.
- The row you clicked shows at once from the list while the rest loads.

---

#### STORY-FIN-013: A Mercury charge with no known receipt

**Type**: short
**Topic**: Receipts
**Persona**: Maya, naive first-time founder
**Goal**: Find out if a receipt exists.
**Preconditions**: NW-BASE: a Mercury spend transaction, one with an attachment upstream and one
without.
**Ideal path**: 2 — open the transaction, click Check for receipt.
**Alternate paths**: none found.

##### Steps
1. Open the Mercury transaction → the Receipt section shows **Check for receipt**.
2. Click it → the button is disabled while checking, then a thumbnail shows (found) or "No receipt"
   (not found).

##### Edge Cases
- The check fails for a reason other than "not found" → the button comes back with no error text.

---

#### STORY-FIN-032: See transactions grouped by vendor

**Type**: short
**Topic**: Transactions
**Persona**: Maya, naive first-time founder
**Goal**: "Twelve rows of Gusto is noise. Show me one line per company."
**Preconditions**: NW-BASE; the browser has never chosen "By vendor".
**Ideal path**: 1 — click By vendor.
**Alternate paths**: the same choice on the month, category, recurring, account and spend pages.

##### Steps
1. Open `/app/finance/spend?period=quarter` → the table has two small buttons, **List** (selected) and
   **By vendor**, in the card header.
2. Click **By vendor** → one row per vendor with "12 transactions", the category (or "Mixed"), and
   the total; a chevron points right. The Date and Status headings go blank.
   - Hesitation: the total is signed (money out has no sign, money in has "+"), and a vendor paid in
     two currencies shows as two rows.
3. Click the `MOCK Gusto Payroll` row → it opens in place and lists its transactions in the normal row
   style; click one → the transaction page.
4. Reload the page → **By vendor** is still selected (the choice is saved on this device).

##### Edge Cases
- Another browser or device starts on **List**; the choice is not part of the account.
- A page with no rows says "No transactions in this period" (account page: "No transactions on this
  account yet").

---

### Stories: Accounts

#### STORY-FIN-014: Look at one account and the card balance

**Type**: medium
**Topic**: Accounts
**Persona**: Maya, naive first-time founder
**Goal**: "How much do we owe on the Brex card, and how much does Treasury earn?"
**Preconditions**: NW-BASE.
**Ideal path**: 2 — open Accounts, click the account.
**Alternate paths**: dashboard "Treasury yield" card links to Accounts; source chip "Mercury" opens
`/app/finance/accounts?source=mercury`; Burn page "By account" rows.

##### Steps
1. Click **Accounts** (top right on the dashboard) → Total cash, Card balance owed, Total balance chart
   with period tabs, Cash accounts with "••last four" and "4.1% yield" pill, and "Card balance owed"
   list. An **Add account** button sits in the page title row.
2. Click **MOCK Treasury ••7730** → Balance, Yield, a Balance chart, a Yield table (Month, Dividends,
   Fee, Net), and Transactions.
   - Hesitation: Transactions shows only the newest rows with no "See more".
3. Click **← Accounts**, then the **Mercury** chip on the dashboard → the Accounts page with a
   "Mercury ×" badge. Click the badge → the filter clears.

##### Edge Cases
- Brex connected but sharing no card balance → "Card balance owed — … Brex does not share it".

---

#### STORY-FIN-033: Open Brex spend from a source filter

**Type**: short
**Topic**: Accounts
**Persona**: Maya, naive first-time founder
**Goal**: "I only want to see what we put on the Brex card."
**Preconditions**: NW-BASE.
**Ideal path**: 2 — click the Brex chip, click Brex spend.
**Alternate paths**: Burn page "By account" → Brex row (`FinanceBurn.tsx:~160`).

##### Steps
1. On the dashboard click the green-dot **Brex** chip → `/app/finance/accounts?source=brex` titled
   "Accounts" with a "Brex ×" badge. The chart is hidden and the cash KPI reads "Brex cash".
2. Read the KPIs → "Brex spend — This month". Click it → `/app/finance/spend?period=month&source=brex`
   with a "Brex ×" badge on the title.
3. Click the badge → the filter clears and the Spend page shows all spend.
4. Try `/app/finance/accounts?source=chase` → the full list with a badge "Unknown source: chase ×";
   clicking it clears the filter.

##### Edge Cases
- Wallets and exchanges are left out of any source-filtered view.

---

### Stories: Crypto

#### STORY-FIN-015: Should crypto count as cash?

**Type**: short
**Topic**: Crypto and runway
**Persona**: Maya, naive first-time founder with a treasury Safe
**Goal**: "Count our USDC in runway, but not ETH."
**Preconditions**: NW-CRYPTO.
**Ideal path**: 2 — open the runway control, choose Stablecoins only.
**Alternate paths**: same control on Accounts (`FinanceAccounts.tsx:~296`) and Runway
(`FinanceBurn.tsx:~262`).

##### Steps
1. On **Runway**, click **Count crypto** → it saves "all crypto" at once. The label changes to
   "Counting all crypto ▾".
   - Hesitation: one click immediately counts volatile tokens; there is no choice first.
2. Open the menu and choose **Stablecoins only** → runway and Cash reload; a Cash list shows Bank,
   Stablecoins ("· not in runway" when off), Other crypto, In runway.
3. Return to the dashboard → the Cash subtitle shows "3 bank accounts + stablecoins" and a "Crypto"
   KPI shows "Stablecoins in runway". Hovering Runway shows "Bank only: 7.9 mo".

##### Edge Cases
- The Count crypto button only shows when there is crypto to count (`hasCrypto`).
- Saving fails → a red line under the button and the choice does not change.

---

#### STORY-FIN-016: Add, rename and remove a wallet and an exchange

**Type**: medium
**Topic**: Crypto
**Persona**: Maya, naive first-time founder
**Goal**: Track the company Safe and the Kraken account, and remove an old wallet.
**Preconditions**: NW-CRYPTO. A Kraken stub that accepts a mock key.
**Ideal path**: 4 — Add wallet, paste address, Add; Remove via menu.
**Alternate paths**: Add account dialog → Wallet or Coinbase/Kraken; Integrations tiles for
Kraken/Coinbase "Connect".

##### Steps
1. Open **Crypto** (the Crypto KPI) → "Updated …", Wallets total, rows with type and "2 of 3", a
   Coinbase section, "Balance over time", Chains, Holdings.
2. Click **Add wallet** → enter `mock-ops2.eth`, label "MOCK Ops 2", type Personal → **Add**.
3. Use the "…" menu (aria-label "Actions for MOCK Ops 2") → **Edit** → change the label → **Save**.
4. "…" → **Remove** → "Remove MOCK Ops 2?" → **Remove**.
5. Go to **Accounts → Add account → Kraken** → enter API key and Private key → **Connect** → Kraken
   shows under Crypto.

##### Edge Cases
- Add the same address twice → "That wallet is already added".
- Unknown ENS → "That ENS name was not found".
- A wallet read that failed shows its error in red at the top of the Crypto page.

---

#### STORY-FIN-035: Wallets without any API key

**Type**: short
**Topic**: Crypto
**Persona**: Maya, naive first-time founder
**Goal**: "I don't have a Blockscout account. Can I still see my wallet?"
**Preconditions**: NW-CRYPTO, no Blockscout key saved.
**Ideal path**: 1 — read the Crypto page.
**Alternate paths**: Integrations → Blockscout tile → menu → Add API key.

##### Steps
1. Open **Crypto** → balances load. A note says "Wallet balances are read from public networks and
   need no key. The Finance agent uses a Blockscout API key, if you add one, for wallet lookups." and
   a button **Add Blockscout API key** (`FinanceCrypto.tsx:~182`).
   - Hesitation: "Blockscout" and "API key" mean nothing to Maya; she cannot tell if the button is
     required.
2. Ignore the button → nothing is blocked.
3. Open Integrations → the Blockscout tile reads "Connected" with **Open Finance** and a "…" menu with
   **Add API key**; the Alchemy tile says "Optional faster balance reads".

---

### Stories: Statements

#### STORY-FIN-017: Upload this month's statement when reminded

**Type**: short
**Topic**: Statements
**Persona**: Maya, whose second bank has no integration
**Goal**: Keep a non-integrated bank current.
**Preconditions**: NW-STATEMENT; file `mock-firstbank-2026-09.csv`.
**Ideal path**: 2 — click Upload, drop the file.
**Alternate paths**: Accounts → Add account → Upload statements.

##### Steps
1. See the banner "Upload the September statement for MOCK First Mock Bank ••5502" (with "+1 more" when
   several are due) → click **Upload**. The dialog opens straight on "Upload statements".
2. Drop the CSV → "Reading…" then a group with period, "opening → closing", "N transactions", "The
   transactions read add up to the closing balance", and "Imported". Earlier statements of the same
   account are listed too.
3. Click **Done** → the banner goes away and totals change.

---

#### STORY-FIN-018: Upload the wrong files

**Type**: medium
**Topic**: Statements
**Persona**: Maya, naive first-time founder
**Goal**: Upload whatever is in the downloads folder.
**Preconditions**: NW-STATEMENT; files `notes.docx`, an oversized PDF, and
`mock-firstbank-2026-08.pdf` with a $12.40 mismatch.
**Ideal path**: 2 — open upload, drop files.
**Alternate paths**: none found.

##### Steps
1. Drop all three → `notes.docx` shows "Upload a PDF, CSV, OFX or QFX file" with **Dismiss**; the large
   file shows "The file is too large".
2. The mismatched PDF is not imported. It waits in a group with a red "Transactions are $12.40 off the
   closing balance", a bold "Read by an AI model…" warning, and two buttons: **Import anyway** and
   **Discard**.
   - Hesitation: "off the closing balance" does not tell Maya which side is wrong. She cannot open the
     file from here to check.
3. Click **Discard** → the row disappears and totals stay as they were. (Or **Import anyway** → it
   shows "Imported" with a **Remove** button.)
4. Close the dialog and reopen Upload statements → earlier imports and any statement still waiting for
   review are listed again, grouped by account.

##### Edge Cases
- A file the server cannot read ("Could not read this file") is discarded server-side and shows a
  red line with **Dismiss**.

---

#### STORY-FIN-034: Rename a statement account

**Type**: short
**Topic**: Statements
**Persona**: Maya, naive first-time founder
**Goal**: "The account is called 'First Mock Bank' from the PDF. I call it 'Backup bank'."
**Preconditions**: NW-STATEMENT.
**Ideal path**: 2 — open the account, click Rename.
**Alternate paths**: none found.

##### Steps
1. Open **Accounts → MOCK First Mock Bank ••5502** → a **Rename** button sits at the end of the title.
   A Mercury account has none.
2. Click **Rename** → a dialog with the current name; type "Backup bank" → save.
3. The title, the Accounts list and Cash all show "Backup bank ••5502".

##### Edge Cases
- Open a Mercury account and look for Rename → no such button (a synced account keeps the bank's name).

---

### Stories: Errors and wrong links

#### STORY-FIN-023: Follow a broken or old link

**Type**: short
**Topic**: Errors
**Persona**: Maya, naive first-time founder
**Goal**: Open a link a teammate pasted.
**Preconditions**: NW-BASE.
**Ideal path**: 1.
**Alternate paths**: none found.

##### Steps
1. Open `/app/finance/transaction/does-not-exist` → "Not found / This page doesn't exist or was
   removed." under a Back button (no retry control).
2. Open `/app/finance/budget` → the same "Not found" page with a "← Finance" button.
3. Open `/app/finance/accounts?source=chase` → the full Accounts list with a badge "Unknown source:
   chase ×".

##### Edge Cases
- The server is down (not a missing item) → a red error with **Try again**.

---

### Stories: Hide amounts

#### STORY-FIN-024: Hide the numbers before someone looks at my screen

**Type**: short
**Topic**: Hide amounts
**Persona**: Maya, naive first-time founder
**Goal**: "My co-founder's friend is sitting next to me. I don't want him seeing our bank balance."
**Preconditions**: NW-BASE, Hide amounts off.
**Ideal path**: 1 — click the eye icon next to the page title.
**Alternate paths**: the account-menu row "Hide amounts" (FIN-025).

##### Steps
1. Open **Finance** → in the title row, left of "Updated 2 hours ago", is a small eye icon (aria-label
   "Hide amounts", `HideAmountsToggle.tsx:11-35`, placed at `Finance.tsx:378`).
   - Hesitation: it is an icon with no text. Maya does not know what it does until she hovers.
2. Hover (or focus) the icon → a tooltip: "Hide amounts. Hides amounts on finance screens and masks
   currency amounts in chat text. Plain numbers in agent replies may still show."
3. Click it → the icon turns into a crossed-out eye (aria-label now "Show amounts", pressed). Cash reads
   "$•••", Monthly burn "$•••", Runway "••• mo" with the date line "Until •••", the spend total
   "$•••", the change "↓ •••%", the Breakdown rows and Upcoming amounts "$•••", and the Subscriptions
   footer "5 subscriptions · $•••/mo".
   - Hesitation: the page changes instantly with no message saying amounts are hidden; only the icon
     shows it.
4. Click the icon again → every number comes back at once, with no reload.

##### Variations
- Cash hover (with crypto): the Bank / Stablecoins / Other crypto / Total rows show "$•••".

##### Edge Cases
- Dollar signs stay and digits never show: the mask is a fixed "•••", so a $9 line and a $1.6M line
  look the same (`finance-format.ts:5`).

---

#### STORY-FIN-025: Turn it on from anywhere in the app

**Type**: short
**Topic**: Hide amounts
**Persona**: Maya, naive first-time founder
**Goal**: "I'm in a chat, not on Finance. I want the numbers hidden before I open the agent."
**Preconditions**: NW-BASE; she is on the Home or chat screen.
**Ideal path**: 2 — open the account menu, click Hide amounts.
**Alternate paths**: the eye icon on Finance, Cap table and every Finance detail page.

##### Steps
1. Click her name and initials at the bottom of the left sidebar (the account menu).
2. Find the row **Hide amounts** with a small grey line "Hides amounts on finance screens and masks
   currency amounts in chat text. Plain numbers in agent replies may still show." and click it
   (`Shell.tsx:4118`).
   - Hesitation: the row sits between Settings and Usage, in a menu she opened for something else; she
     only finds it by reading.
3. The menu closes. The row now reads **Show amounts**. Open Finance → the eye icon is already
   crossed out and every amount is masked.

##### Variations
- The eye button on a detail page (for example `/app/finance/burn`) is in the back/breadcrumb row,
  between the trail and the Ask button (`ui.tsx:232`). Toggling there is the same switch.
- Cap table has its own eye icon in its title row (`CapTable.tsx:589`).

---

#### STORY-FIN-026: Does it remember? Reload, sign out, another device

**Type**: medium
**Topic**: Hide amounts
**Persona**: Maya, naive first-time founder
**Goal**: "I turned it on yesterday. Will it still be hidden when I open my laptop?"
**Preconditions**: NW-BASE, Hide amounts on in this browser.
**Ideal path**: 2 — reload the page and check.
**Alternate paths**: none found.

##### Steps
1. With amounts hidden on `/app/finance`, press reload → the page loads and the amounts are masked from
   the first paint; the icon is the crossed-out eye. The choice is saved in this browser's local
   storage as `rakazo.hideAmounts = on` (`hide-amounts-preference.ts:3-34`).
2. Close the browser, open it tomorrow → still hidden.
3. Open Praci on her phone or another computer → amounts are **shown**. The choice is per browser,
   not per account, and not synced.
   - Hesitation: she assumed "my account" remembers it. On a new device the numbers are visible until
     she clicks the icon.
4. Open Finance in a second tab of the same browser while the first is open, then toggle in tab 2 →
   tab 1 still shows the old state until she reloads it (there is no cross-tab listener).
5. Sign in as a different person in the same browser → the choice stays (the key is not per user).

##### Edge Cases
- The browser blocks storage (private window, blocked site data) → the switch works for this session
  only (kept in memory) and is lost on reload; no message says so.
- A first visit has no saved value → amounts are shown.
- Turning it off writes `off`, so it does not come back by itself.

---

#### STORY-FIN-027: Look at the detail pages while hidden

**Type**: medium
**Topic**: Hide amounts
**Persona**: Maya, naive first-time founder
**Goal**: "I'm walking my accountant through the burn and the AWS charges, but I don't want the
amounts to show up on the shared screen yet."
**Preconditions**: NW-BASE, Hide amounts on.
**Ideal path**: 4 — Burn, a month, a vendor, a charge.
**Alternate paths**: none found.

##### Steps
1. Open **Burn** → the KPI is "$•••"; the chart axis labels read "$•••"; hovering a bar shows an
   aria-label like "Oct: $•••"; the By month table shows "$•••" for Out and In and "+$•••" / "−$•••" for
   Net (the sign still shows); "By account" shares read "•••%".
   - Hesitation: the bars still have their heights. Anyone can see that August was far taller than
     July even though no dollar figure shows.
2. Click **August 2026** → Out, In, Net are masked; the Categories list shows names with "$•••"; the
   Transactions table shows dates, merchant names and "$•••" amounts. Merchant names, categories,
   memo text and dates are not masked.
3. Open the **MOCK AWS** vendor → Monthly avg "$•••", Change "↑ •••%", First seen and Paid with are
   still visible, the monthly chart bars keep their shape with masked value labels.
4. Open a charge with a receipt → the receipt thumbnail is replaced by a plain document icon; click it
   and `/app/finance/receipt/<id>` says "Receipt hidden while amounts are hidden" (an invoice image
   would show the amount). The **Open receipt** button is not shown.
5. Open **Runway** → Cash and Monthly burn are masked, Runway reads "•••", Run-out reads "•••" and the
   projected-month labels on the chart are masked; the history labels stay.

##### Edge Cases
- Transaction memo: `Invoice 4417 — $4,200 deposit` is shown in full, because Finance pages mask the
  numeric fields, not free text from the bank (see Suspected problems).
- Token quantities on the Crypto page ("1,240.5 USDC") read "•••"; token symbols and chain names stay.
- Statement dialog: opening and closing balances and the "$12.40 off" line are masked; the file period
  and "12 transactions" stay.

---

#### STORY-FIN-028: Crypto and accounts while hidden

**Type**: short
**Topic**: Hide amounts
**Persona**: Maya, naive first-time founder with a treasury Safe
**Goal**: Show the team the wallets without the balances.
**Preconditions**: NW-CRYPTO, Hide amounts on.
**Ideal path**: 2 — open Accounts, open Crypto.
**Alternate paths**: none found.

##### Steps
1. Open **Accounts** → Total cash and Card balance owed read "$•••"; each account row shows "$•••"; the
   yield pill reads "••• % yield"-style masked text (`percentFigure`); the Crypto group lists wallet
   and exchange names with "$•••".
2. Open **Crypto** → the Wallets total is "$•••"; the Holdings table shows symbols and chains but
   balances read "•••" and values read "$•••"; "1 unpriced" still shows.
3. Click the Coinbase section → asset balances and values are masked.

##### Edge Cases
- Wallet addresses, ENS names and labels are not masked.

---

#### STORY-FIN-029: Cap table and chat while hidden

**Type**: medium
**Topic**: Hide amounts
**Persona**: Maya, naive first-time founder
**Goal**: "Hide means hide everywhere, right? Even in the agent chat and the Cap table?"
**Preconditions**: NW-HIDDEN, Hide amounts off to start.
**Ideal path**: 3 — toggle, open Cap table, open the Finance agent.
**Alternate paths**: none found.

##### Steps
1. On Finance, click the eye icon (hide on).
2. Open **Cap table** → the eye icon in its title row is also crossed out. Share counts read "•••",
   dollar values "$•••", and percentages "•••%" (`usdFigure`, `shareCount`, `percentFigure`).
3. Go back to Finance and click **Ask** → the Finance agent panel opens. The earlier turn's finance
   cards show "$•••" for Cash and Monthly burn, "••• mo" for Runway, and tables show "$•••".
4. Read an agent text reply that said "We have $1.62M in cash and 7.9 months of runway" → it reads
   "We have $••• in cash and 7.9 months of runway". The month count is **not** masked, because only
   currency amounts in text are masked.
   - Hesitation: the tooltip warns "Plain numbers in agent replies may still show", but Maya does not
     expect runway to be shown when cash is hidden.
5. Scroll to the chart message → it shows "Chart hidden while amounts are hidden" instead of a plot.
6. Look at the chat list preview, a reply quote and the browser notification text for the last
   message → currency amounts are masked there as well. Copying a message copies the masked text.
7. Click the eye icon again → text, cards and the chart come back without reloading.

##### Variations
- Search the space for "invoice" → result labels with dollar amounts are masked.
- Data room previews of images hide while amounts are hidden.

##### Edge Cases
- Stored messages are never changed; only the display is masked.

---

#### STORY-FIN-030: Hide amounts on a phone

**Type**: short
**Topic**: Hide amounts
**Persona**: Maya, naive first-time founder (iPhone, 390 px wide)
**Goal**: "I'm on the train, I want to check cash without the whole carriage reading it."
**Preconditions**: NW-BASE, Hide amounts off, phone width.
**Ideal path**: 2 — open Finance, tap the eye icon.
**Alternate paths**: the account menu in the mobile sidebar.

##### Steps
1. Open **Finance** on the phone → the eye icon in the title row has a larger touch target
   (40 px, `pointer-coarse:size-10`).
2. Tap it → amounts mask. There is no hover, so the explanation tooltip does not appear.
   - Hesitation: without the tooltip, Maya never reads the warning that plain numbers in agent
     replies can still show.
3. Open the sidebar menu, tap her name at the bottom, and see **Hide amounts** / **Show amounts** with its
   helper line, which does show on touch.
4. Open Burn on the phone → the eye icon wraps with the back button and Ask on the first line, with
   the breadcrumb on its own line.

##### Edge Cases
- Charts keep their shape on the phone too.

---

#### STORY-FIN-031: Hide amounts with the keyboard only

**Type**: short
**Topic**: Hide amounts
**Persona**: Maya, naive first-time founder (keyboard and screen reader)
**Goal**: Turn the switch on without a mouse.
**Preconditions**: NW-BASE.
**Ideal path**: 2 — Tab to the icon, press Enter.
**Alternate paths**: none found.

##### Steps
1. Press Tab from the page start on `/app/finance` until focus reaches the eye button → a visible focus
   ring; a screen reader says "Hide amounts, toggle button, not pressed".
2. Press Enter or Space → "Show amounts, toggle button, pressed"; amounts are masked.
3. Press Tab again → focus moves on to the refresh button (the eye keeps focus after being pressed).
4. Look for a shortcut such as a key combination to flip the switch from anywhere → none exists.
5. In the account menu, Tab to **Hide amounts** and press Enter → the same switch flips and the menu
   closes.

##### Edge Cases
- Screen readers read masked amounts as "dollar sign, bullet bullet bullet", with no spoken hint that
  an amount is hidden.

---

### Stories: Long end-to-end stories

#### STORY-FIN-019: First morning with Finance

**Type**: long
**Topic**: End to end
**Persona**: Maya, naive first-time founder
**Goal**: Connect both banks and understand cash, burn, runway and the biggest costs before a board
call.
**Preconditions**: NW-EMPTY, Mercury and Brex OAuth stubs that load NW-BASE data.
**Ideal path**: 8 — Finance, Add account, Mercury, approve, Add Brex, approve, read KPIs, open
Breakdown top row.
**Alternate paths**: connect both from Integrations.

##### Steps
1. Click **Finance** → "No accounts yet" empty state.
2. **Add account → Mercury** → approve → dashboard syncs.
3. Click **Add Brex** in the header → lands on Integrations, not a dialog.
   - Hesitation: the founder thinks they left Finance.
4. Click **Connect** on Brex → approve → tile shows **Open Finance**.
5. Click **Open Finance** → Brex chip shows; "Add Brex" is gone.
6. Read Cash, Monthly burn, Runway, and the bold spend total.
7. Click **Runway** → read Run-out and the list of what counts.
8. Click **← Finance** → Breakdown → **Payroll** → category page.
9. Click a vendor → vendor page → click one charge → transaction page.
10. Use breadcrumbs to go back to Finance.
11. Open **Burn → By month** and compare the last three months.
12. Click **Accounts** → confirm "Card balance owed — Not counted in cash".
13. Return and click **Refresh** to see "Updated just now".
14. Click **Ask** (top right) → the panel opens and says it is creating the Finance agent (a
    disabled **Create Finance agent** button while creating); once ready it offers two questions: "What
    is our runway?" and "Where did spend go up this month?".
15. Type "Summarize cash, burn and runway for my board call" → finance cards show in the chat.
16. Compare the chat card's Runway with the dashboard's.
    - Hesitation: the card now shows one decimal like the dashboard ("7.9 mo"), so they match; the
      first-timer may still look for a way to share the page.

---

#### STORY-FIN-020: Write an investor update that includes crypto

**Type**: long
**Topic**: End to end with crypto
**Persona**: Maya, naive first-time founder
**Goal**: Report cash with and without stablecoins and the biggest cost changes.
**Preconditions**: NW-CRYPTO with Finance agent created.
**Ideal path**: 6.
**Alternate paths**: answer only from the agent.

##### Steps
1. Open Finance → Crypto KPI shows; hover Cash for Bank / Stablecoins / Other crypto / Total incl.
   crypto.
2. Open **Crypto** → check Holdings; an unpriced token shows "—" and "1 unpriced".
3. Open **Runway → Count crypto → Stablecoins only**.
4. Back on the dashboard, hover Runway → "Bank only: X mo".
5. Open **Breakdown → Vendor**; note vendors with red Change.
6. Open the vendor pages for the top 2 risers.
7. Click **Ask** → "Draft an investor update: cash bank-only and with stablecoins, runway, top 3 cost
   increases."
8. Hover a finance card → click **Ask about this** → the composer quotes that message; ask a
   follow-up.
9. Click a card row → the matching Finance page opens.
10. Ask the agent to "Move $50k from checking to treasury" → it replies it cannot move money.
11. Turn counting back off with **Don't count crypto**.

---

#### STORY-FIN-021: Track a bank that has no integration

**Type**: long
**Topic**: End to end with statements
**Persona**: Maya, naive first-time founder
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
5. Open it → balance chart and transactions show. There is no Yield table. A **Rename** button is in
   the title row.
6. Next month, see the reminder banner → **Upload**.
7. Open the Upload dialog again → the three earlier statements are listed with **Remove**; this is
   where a bad month is removed.
8. Look to delete the account itself → no control exists; removing every statement is the only way.
9. Ask the agent "Which statements have I uploaded?".

---

#### STORY-FIN-022: Monthly review with the agent, pins and a reconnect

**Type**: long
**Topic**: Agent, pins, reconnect
**Persona**: Maya, naive first-time founder
**Goal**: Run the month-end close checklist and fix a broken bank link.
**Preconditions**: NW-RECONNECT + NW-AGENT.
**Ideal path**: 6.
**Alternate paths**: open "Finance agent" from the sidebar bot list (see Suspected problems).

##### Steps
1. Open Finance → the Mercury chip has a yellow dot. Click it → Integrations.
   - Hesitation: the chip has no "Reconnect" text, only an aria-label.
2. On the Mercury tile ("Reconnect" badge) click **Reconnect** → approve.
3. Click **Open Finance** → green dot.
4. Click **Ask** → the panel shows the thread with "3 finance lookups" collapsed. Expand it.
5. Look for the "Month-end close" checklist and the Cash/Runway pins → they are not shown in the
   Finance side panel.
6. Find **Finance agent** in the sidebar bot list → open it → the pins strip and List button show.
7. Tick "Reconcile Brex" on the checklist.
8. Ask the agent to "update the Runway pin" → click the pin refresh.
9. Return to Finance → the panel is closed again (it starts closed every visit).
10. Turn Hide amounts on, then open the Finance agent from the sidebar → the pin strip still shows the
    real Cash and Runway values (see Suspected problems).

---

#### STORY-FIN-036: Share my screen on the board call

**Type**: long
**Topic**: Hide amounts end to end
**Persona**: Maya, naive first-time founder
**Goal**: Walk the board through the product demo on a shared screen, hide money first, then show
cash on purpose.
**Preconditions**: NW-HIDDEN, Hide amounts off.
**Ideal path**: 8.
**Alternate paths**: use only the account-menu row.

##### Steps
1. Before the call, open Finance and click the eye icon → everything masks.
2. Reload to be sure → still masked.
3. Open **Cap table** → shares, values and percentages masked.
4. Open **Burn**, **Runway**, **Spend**, **Accounts** and **Crypto** in turn → all figures show "$•••".
   - Hesitation: charts still show the rise and fall, so the board can see burn is growing.
5. Click **Ask** and ask "What is our runway?" → the reply text masks "$1.62M" but writes "7.9
   months".
6. Open the Finance agent from the sidebar → the Cash pin shows the real number (see Suspected
   problems); she collapses the pins before sharing.
7. Open the Data room, an invoice image preview → "Image hidden while amounts are hidden"; the invoice amount shown in the list is "$•••".
8. At the board's request for the cash number, she opens the account menu → **Show amounts** → all
   numbers return at once, no reload.
9. After the call she turns it on again before closing the laptop.

### Redundancy Candidates (this area)

- Two places connect a bank: the Add account dialog (Mercury, Brex) and the Integrations page; "Add
  Brex" on the dashboard goes to Integrations instead of reusing the dialog (`Finance.tsx:410-416`).
- Three controls open the same Accounts page from the dashboard: the Cash card, the Accounts button,
  and the Treasury yield card; the source chips open it filtered.
- The runway-crypto control (`CountCryptoButton`) appears on both Accounts and Runway.
- Hide amounts has three entry points (Finance-page icon, detail-page icon, account-menu row) and a
  fourth on Cap table; they flip one switch, which is fine, but the icon has no text label.
- Blockscout and Alchemy tiles both read as "wallet balances"; the key is optional for both.

### Suspected problems (this area)

1. **Pins show real amounts while Hide amounts is on.** `pages/shell/bot-pins.tsx:73` renders
   `stat.value` with no masking and imports no hide helper. The pin strip lives on the bot route
   (Cash "$1.62M", Runway "7.9 mo"), and text pins and checklist items are not masked either.
2. **Memo and counterparty text on Finance pages are not masked.** `TransactionRow` and
   `FinanceTransaction.tsx:~203` render `row.memo` and `txn.memo` as plain text; a memo like
   "Invoice 4417 — $4,200 deposit" shows in full. Chat text goes through `maskCurrencyWhenHidden`,
   Finance free text does not.
3. **Charts keep their shape.** `BurnBars`, `LineChart` and `MonthBars` draw proportional bars
   and lines (`charts.tsx`), masking only the labels and aria-labels, so relative size and trend stay
   visible. The chat chart is the only one replaced entirely ("Chart hidden while amounts are hidden").
4. **No keyboard shortcut and no cross-tab update.** The preference store has only in-process
   listeners (`hide-amounts-preference.ts:36-46`); another open tab keeps showing amounts until it is
   reloaded. A user who flips it in a hurry in one tab may think it is on everywhere.
5. **Per browser, not per account.** The key `rakazo.hideAmounts` is global to the browser; a second
   device starts with amounts shown and signing in as someone else keeps the previous choice.
6. **Tooltip is the only explanation, and the warning never reaches phones.** "Plain numbers in agent
   replies may still show" is in a hover tooltip (`HideAmountsToggle.tsx:34`); on touch it is only in
   the account-menu row. Months of runway in an agent reply still show with cash masked.
7. **Storage failure is silent.** If `localStorage` throws, the choice lasts only for the session and
   nothing tells the user (`hide-amounts-preference.ts:25-31`).
8. **Run-out and "Until <month>" are masked, but the Runway chart's solid history labels are not**
   (`FinanceBurn.tsx:~278` masks only projected months). That is intended but means past month
   labels still reveal how long the history is.
9. **Cash subtitle does not name the accounts** ("3 bank accounts"), and "1 non-USD not counted" has
   no link to the transaction (`Finance.tsx:~395`).
10. **Pins are not shown in the Finance side panel**, and the Finance agent still appears in the
    sidebar bot list, so the same agent has two homes with different features (`Shell.tsx:3090`,
    `:4286`: pins render only when `!pageMode`).
11. **Dashboard "Add Brex" leaves Finance** for Integrations; there is no way back except the sidebar.
12. **No disconnect, no cancel, no recategorize**: the Finance area is read-only apart from
    statements, wallets, the runway scope and renaming a statement account.


---

## Area: Legal (STORY-LEG-nnn)

Source: `docs/ux-paths/legal/catalog.md`.

Generated: 2026-10-17
Code read at: `origin/feat/legal` commit **f2b8fc1e** (PR #109, "Legal: regenerate translation catalogs after the e2e fixes"). The checkout this catalog lives in is `559a76ad` (`docs/ux-pass`), which does not contain Legal. The previous catalog read `488048d5`.
Total Stories: 29 (Short 12, Medium 13, Long 4)
Persona for every story: Maya, a first-time founder (MOCK DEMO DATA, Northwind Robotics). Maya has never seen Praci. She does not know words like "agent", "scan", "consent", "Data room", "node" or "Muse Spark". She wants one thing: run the company without missing a contract date.

### Read this first: where the Legal code is

- **Legal is not on `docs/ux-pass` or `origin/main`.** It merges from PR #109 (branch `origin/feat/legal`). Everything below was read from that branch with `git show origin/feat/legal:<path>` and nothing else. Nothing was run in a browser; every expected result is read from code, and anything that depends on the model's behaviour is marked as a hypothesis.
- File:line references are to `origin/feat/legal` at f2b8fc1e. `Legal.tsx` = `apps/web/src/pages/Legal.tsx`; `LegalDeadlines.tsx` and `LegalContracts.tsx` are in `apps/web/src/pages/legal/`; `LegalGraph.tsx` and `ConsentPrompt.tsx` are in `apps/web/src/components/legal/`; `legal-tools.ts` is `packages/adapters/src/legal-tools.ts`; `api-legal.ts` is `apps/api/src/legal.ts`; `legal-agent.ts` (API) is `apps/api/src/legal-agent.ts`; `db/legal.ts` is `packages/db/src/legal.ts`.
- **The walk only works against a build that contains feat/legal.** On a build from `origin/main` there is no `/app/legal` route and no Legal sidebar item, so STORY-LEG-020 fails at step 1 and everything else cannot run.
- The same PR changes the Data room (a consent prompt, "import from email", "import from Drive"). Those are covered by the Data room catalog. Here they are only referenced (STORY-LEG-018, STORY-LEG-028).
- The earlier problem list (P-nn, S-nn, C-nn) came from the previous catalog and a prior review. Where this PR fixed one, it is named in "Changes". The open ones are re-stated, with fresh line numbers, in "Suspected problems (this area)" at the end.

### Changes since the 2026-10-16 catalog

The Legal commits since 488048d5 that change what a user sees: `422ee8bd` (scan feedback and failure, undo, urgency, notes, hide amounts, readable graph relations), `de0b73fa` (overview exposes the newest scan run), `e0f9fe25` (routine skips while a scan runs), `7ae3f204` and `0b6332fb` (derived and recurring deadlines), `460eeaa3` (consent gating, denied-connection filter), `d8642a65` (deleting a Data room item cascades), `499c9642` (merge fixes).

**Kept (steps unchanged or only lightly touched):** STORY-LEG-008, 009, 014, 015, 016, 018, 019.

**Changed (same id, rewritten to match the new code):**
- STORY-LEG-001: no centre "Scan now" any more (one button only, `Legal.tsx:208-213`); the page now polls and shows the result by itself; warning line has an "Open Models settings" button; the tabs do not show at all until there is a contract or a deadline.
- STORY-LEG-002: the warning now has a button "Open Models settings" and reads "Legal runs only on Muse Spark 1.2, which needs an OpenRouter key." (`Legal.tsx:181-192`). Scan now is disabled whenever the model is not Muse Spark 1.2, so the Anthropic-only case is a blocked button, not a failing scan (old P-12, P-13).
- STORY-LEG-003: the page re-reads itself when Settings closes and when the window regains focus (`Legal.tsx:83-104`). The old "it didn't save" confusion (P-11) is gone in principle.
- STORY-LEG-004: card is shown only when a model is ready and there is at least one recipient (`Legal.tsx:198`); the disabled Scan now now says why ("Allow access below first." / "Connect a model in Settings first.", `Legal.tsx:136-141`). Still no Not now, still no revoke.
- STORY-LEG-005: "Scanning…" now lasts until the run really ends (polls every 4 s, gives up after 5 min, `Legal.tsx:23-25,105-117`); the page updates itself (old P-09 fixed). Still no progress count.
- STORY-LEG-006: the caption can now say "Last scan failed: <reason>" with a Retry button (`Legal.tsx:153-170`); manual Scan now counts as a scan (it is created with trigger `routine`, `api-legal.ts:176`). Nothing yet says the scan runs daily at 06:00 UTC, and a paused routine still shows nothing.
- STORY-LEG-007: Deadlines rows now say "Overdue by N days" or "Due in N days / today / tomorrow" within 30 days; Undo exists; Overdue tile uses the viewer's date; notes under derived rows. Tile is still not a link.
- STORY-LEG-010: unchanged behaviour (skipped files invisible) but the Unreviewed tile now excludes files from a denied connection in the agent's own list while the page tile does not (see S-LEG-05).
- STORY-LEG-011: "Due in N days" text now helps (old P-16 fixed); the page still opens on Contracts.
- STORY-LEG-012: Done and Dismiss now show a status line with Undo for 8 seconds (`LegalDeadlines.tsx:15,71-82`). Old P-10 partly fixed (no history, and a second close replaces the first Undo).
- STORY-LEG-013: after a renewal the notice deadline for the new term is created (a changed date opens a new row, `legal-tools.ts:393-410`); old P-01 fixed.
- STORY-LEG-017: recurring deadlines are now picked up by the scan (`LEGAL_SCAN_PROMPT` step 3, `legal-agent.ts:16`), old P-02 is now model-dependent rather than certain.
- STORY-LEG-020: still gates everything; now names PR #109 and f2b8fc1e.

**Dropped:** none. (No behaviour covered by a previous story was removed.)

**Added:** STORY-LEG-021 (empty page before the first scan), 022 (a scan fails, Retry), 023 (come back while a scan is running), 024 (phone width), 025 (page fails to load, or a refresh fails mid-scan), 026 (Hide amounts), 027 (keyboard only), 028 (deleting a document removes its contract and dates), 029 (a contract ends, its reminders disappear).

### What the mock demo account contains (from the seed), and what it lacks

Seed source is the demo seed in the `rakazo-demo` worktree (`packages/testkit/src/cli/demo/data.ts`, `demo/seed.ts`); not re-read for this pass, copied from the previous catalog.

Seeded and relevant to Legal:
- Data room folder **Legal** with four PDFs: `MOCK Master Services Agreement - Halcyon Logistics.pdf` (24 months, liability cap 1x fees, termination for convenience on 60 days notice), `MOCK Mutual NDA - Acme Ventures.pdf` (3 years), `MOCK Office Lease - 100 Placeholder Street.pdf` (7,500 dollars a month, "Renewal date 31 January. Notice of renewal due 30 November."), `MOCK SAFE - Quill Capital.pdf` (250,000 dollars, cap 8,000,000, discount 20 percent). Folders Finance, Fundraising, Product hold five non-legal files (board deck, budget CSV, investor update, cap table CSV, roadmap).
- Mail that is legal in nature: "Redlines on the Master Services Agreement" (two messages), "Legal notice: trademark office action response due in 30 days", "Office lease renewal option" ("renews on Jan 31 ... tell us by Nov 30").
- An ordinary bot **Legal Desk (mock)**, title "Contracts", in the group chat "Leadership sync (mock)". It has no legal tools.
- A model key only if the person who starts the demo has `OPENROUTER_API_KEY` in the environment. Without one the runtime is scripted.

Not seeded: any `legal_contracts`, `legal_deadlines`, `legal_nodes`, `legal_edges` rows; the Legal agent bot (created the first time the Legal page loads, `api-legal.ts:34`); the Legal consent row.

Named demo-data states used in Preconditions:
- **D0 (fresh)**: the seed on a build that includes feat/legal, started with `OPENROUTER_API_KEY` set so the Legal agent's model (`openrouter / meta/muse-spark-1.2`, `contracts/legal.ts`) resolves.
- **D0-nokey**: D0 with no model key, or only an Anthropic key.
- **D1 (scanned)**: D0 after one successful Scan now. Expected if the model follows its instructions: 4 contracts, 5 Data room files recorded as not legal. Hypothesis, not observed: few or no deadlines, because the seed PDFs state no effective dates or years (S-LEG-02).
- **D2 (seeded legal rows)**: D1 plus rows inserted for the walk so date behaviour does not depend on the model. Proposed rows (MOCK DEMO DATA): Lease active, expires 2027-01-31, `autoRenews` true, `renewalNoticeDays` 62 -> derived "Renews 2027-01-31" and "Renewal notice deadline 2026-11-30"; MSA active, effective 2026-03-01, expires 2028-02-29, value 12000000 cents USD; NDA active, expires 2029-06-30, `autoRenews` false; SAFE status unknown, no dates; one manual deadline "Trademark office action response" due 2026-11-14; one overdue deadline "Q3 board consent signature" due 2026-10-10. Graph: nodes for Northwind Robotics Mock (company), Halcyon Logistics Mock, Acme Ventures Mock, Landlord Placeholder LLC Mock, Quill Capital Mock, the four contracts, "Delaware" (jurisdiction); edges `party_to`, `governed_by`, `owes` with short source quotes. Today in the walk = 2026-10-16.

### Summary

| Type | Count | Stories |
|---|---|---|
| Short | 12 | 004, 006, 009, 011, 012, 014, 016, 019, 021, 023, 026, 029 |
| Medium | 13 | 002, 003, 005, 008, 010, 013, 015, 018, 022, 024, 025, 027, 028 |
| Long | 4 | 001, 007, 017, 020 |

### Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Find Legal in the sidebar, page chrome | 001, 020 | none |
| Model requirement (OpenRouter key, Muse Spark 1.2) and Settings link | 002, 003, 020 | exact Settings > Models wording not read |
| Consent card (Allow) | 001, 004 | no review or revoke exists (S-LEG-08) |
| Empty page before first scan | 021, 001 | none |
| Scan now, Scanning state, polling | 001, 005, 023 | concurrent routine + manual scan only read in code |
| Scan failure, Retry, Last scan caption | 006, 022 | paused routine not shown (S-LEG-07) |
| KPI tiles | 001, 007, 009 | tiles are not links |
| Contracts tab | 007, 008, 010, 024 | no sorting, filtering or search |
| Deadlines tab: read, urgency text, Done, Dismiss, Undo | 007, 011, 012, 013, 017, 027 | no closed/history view (S-LEG-06) |
| Derived and recurring deadlines | 013, 017, 029 | recurring depends on the model |
| Documents marked not legal | 010 | no user control (S-LEG-03) |
| Graph tab | 014, 015, 027 | no search, no legend |
| Legal agent panel | 016, 018, 019 | panel at phone width not read |
| Mail and Drive findings | 018 | Drive not seeded |
| Data room link-through | 008, 028 | missing/deleted item shows nothing (S-LEG-09) |
| Legal agent vs other bots | 019 | none |
| Hide amounts | 026 | toggle is not on the Legal page |
| Phone width | 024 | panel overlay not read |
| Load failure | 025 | none |
| Feature missing from the build | 020 | none |

### Story Dependency Graph

```text
STORY-LEG-020 (Legal tab missing from the build)  [run first; if it fails, stop]
STORY-LEG-001 (First week: find Legal, set up, first scan, check dates)  [D0]
├── STORY-LEG-021 (Empty page before the first scan)
├── STORY-LEG-002 (Warning about a key, no key)  [D0-nokey]
│   └── STORY-LEG-003 (Add the key, come back)
├── STORY-LEG-004 (Allow card)
├── STORY-LEG-005 (First Scan now, watching for a result)
│   ├── STORY-LEG-022 (A scan fails, Retry)
│   ├── STORY-LEG-023 (Leave during a scan, come back)
│   ├── STORY-LEG-006 (Last scan caption)
│   ├── STORY-LEG-009 (What "Unreviewed documents" means)
│   ├── STORY-LEG-010 (Where did the board deck go? not-legal files)
│   └── STORY-LEG-018 (Contracts found only in email)
├── STORY-LEG-007 (Monday morning legal check)  [D2]
│   ├── STORY-LEG-008 (Open the lease from the table and come back)
│   │   └── STORY-LEG-028 (Delete the lease file in the Data room)
│   ├── STORY-LEG-011 (What is due soon?)
│   ├── STORY-LEG-012 (Done vs Dismiss, Undo)
│   ├── STORY-LEG-013 (Lease renewed, dates move)
│   │   └── STORY-LEG-029 (A contract ends, reminders disappear)
│   ├── STORY-LEG-014 (Who are we signed with? Graph)
│   │   └── STORY-LEG-015 (Big graph, cannot find a party)
│   ├── STORY-LEG-016 (Ask the agent "what do we owe this month")
│   ├── STORY-LEG-024 (Same check on a phone)
│   ├── STORY-LEG-025 (Page fails to load / refresh fails)
│   ├── STORY-LEG-026 (Hide amounts is on)
│   └── STORY-LEG-027 (Keyboard only)
├── STORY-LEG-017 (A quarter of running the company on Legal)  [D2, long]
└── STORY-LEG-019 (Two legal bots: Legal Desk (mock) vs Legal agent)
```

---

### Stories: Setup and first run

#### STORY-LEG-001: First week as a founder: find the legal stuff, set it up, see my dates

**Type**: long
**Topic**: First-time setup, end to end
**Persona**: Maya, founder of Northwind Robotics, first login, has heard "Praci keeps track of contracts"
**Goal**: See every contract the company has signed and the next date Maya must act on, without reading legal PDFs
**Preconditions**: D0. Build includes feat/legal. Signed in as the seeded demo user. Four legal PDFs in Data room > Legal are indexed (status `ready`). No Legal agent, no consent row, no legal rows.
**Ideal path**: 3 (open Legal, click Allow, read the list). Real path is 4 or more: scanning does not start by itself, so Maya must also find and click Scan now
**Alternate paths**: open the "Legal Desk (mock)" bot in the roster and ask it (an ordinary bot with no legal tools, STORY-LEG-019); ask Chief in chat; open Data room > Legal and read each PDF.
**Source**: extends prior STORY-LEG-001

##### Steps
1. Maya scans the sidebar for "contracts". She sees Inbox, Finance, **Legal** (scale icon), Cap Table, Data room (`Shell.tsx:3373-3410`). She clicks Legal. URL becomes `/app/legal`; a skeleton (title bar, five tiles, a block) shows, then the page. Visiting silently creates the Legal agent and its daily routine (`api-legal.ts:30-36`, `legal-agent.ts:63-98`).
2. She reads the header: "Legal", a small grey "Not scanned yet", and two buttons, **Scan now** and **Ask agent** (`Legal.tsx:149-180`). **Hesitation:** "Ask which agent? Is that a person?" The button does not say "Legal".
3. A warning-bordered card appears: "Let the Legal agent read your documents", a sentence ("The full text of your documents and, for images, the page images are sent to the providers below to read, file and search them."), a recipient line such as "OpenRouter · Meta Muse Spark 1.2", and **Allow** (`ConsentPrompt.tsx:39-70`, `data-room-api.ts:118`). Next to the greyed Scan now, small grey text says "Allow access below first." (`Legal.tsx:136-141,172-174`). **Hesitation:** "Who is OpenRouter? Is my cap table going there?" There is no Cancel, no "Learn more", no folder list.
4. She clicks Allow. The card disappears; no confirmation text. The grey reason beside Scan now disappears and the button is enabled.
5. She sees five tiles: Contracts 0, Active 0, Open deadlines 0, Overdue 0, Unreviewed documents 9 (`Legal.tsx:201-207`). **Hesitation:** "9? I uploaded 4 contracts." (The count is every ready Data room file, S-LEG-01.)
6. Below the tiles there is one sentence, "The Legal agent scans your Data room for contracts and deadlines." and nothing to click (`Legal.tsx:208-213`). No tabs yet. She looks up and clicks the header **Scan now**.
7. The button changes to "Scanning…" and is disabled; a side panel opens with the Legal agent's chat (`Legal.tsx:119-129`, `Shell.tsx:2568-2571`). If the agent bot was not yet in the bot list, the panel first shows a **Create Legal agent** button (`Shell.tsx:4261-4264`).
8. She watches the panel. In the page behind, every 4 seconds the overview is re-read (`Legal.tsx:105-117`). When the run ends: "Scanning…" turns back to "Scan now", "Last scan just now" appears, tiles fill in (Contracts 4, Unreviewed 0, if the model followed its instructions) and the tabs appear.
9. She opens the **Contracts** tab (default) and sees a table: Contract, Parties, Status, Term, Renewal, Value, Next deadline (`LegalContracts.tsx:35-63`). Expected four rows; many dashes if the PDFs lack dates (S-LEG-02).
10. She looks for the lease notice date she half-remembers from an email (Nov 30) and clicks **Deadlines**. With the seed she may see "No open deadlines." **Hesitation:** "So nothing is due? That can't be right."
11. She types in the panel: "When do I have to tell the landlord about the lease?" The agent answers from `legal_query` or by reading the PDF; whether it records a deadline depends on the model.
12. She closes the panel with the collapse control (label "Collapse Legal agent", `Shell.tsx:4251`); **Ask agent** returns in the header.

##### Variations
- D0-nokey: no card; both buttons blocked; see STORY-LEG-002.
- Data room files still processing: Unreviewed counts only `ready` files (`db/legal.ts:97`), so it reads lower than what Maya uploaded.
- Panel already open when Scan now is clicked: the header has no Ask agent (it is hidden while the panel is open, `Legal.tsx` via `AskAgentButton`), and the panel just stays.

##### Edge Cases
- Maya double-clicks Scan now: the button disables after the first click only once the overview says running; two quick clicks make one run (per-bot lock, `api-legal.ts:149-159`).
- She leaves the page while scanning: the panel closes (`Shell.tsx:881`); the run keeps going (STORY-LEG-023).

#### STORY-LEG-002: "It says I need an OpenRouter key. What is that?"

**Type**: medium
**Topic**: Model requirement
**Persona**: Maya, no AI accounts of her own
**Goal**: Make the Legal page work
**Preconditions**: D0-nokey (no model key, or only an Anthropic key). No legal rows.
**Ideal path**: 2 (click "Open Models settings", paste a key)
**Alternate paths**: open Settings from the sidebar menu and find Models; ask the agent (it replies with `LEGAL_MODEL_REQUIRED_MESSAGE`, "The Legal agent runs only on Muse Spark 1.2. Add an OpenRouter key in Settings.", `contracts/legal.ts`, `executor.ts:3877-3886`).
**Source**: prior STORY-LEG-002

##### Steps
1. Maya opens `/app/legal`. Under the header: "Legal runs only on Muse Spark 1.2, which needs an OpenRouter key." and a button **Open Models settings** (`Legal.tsx:181-192`). **Hesitation:** three unknown terms (Muse Spark, OpenRouter, key), but at least there is a button.
2. She looks at Scan now: greyed (`scanDisabled`, `Legal.tsx:135`). There is no reason text beside it in this state (the reason is only for the consent case); the warning above is the explanation.
3. She clicks Open Models settings. Settings opens on Models (`Shell.tsx:4183`, `openSettings("models")`). She must still know which provider to choose and where to get a key; the page does not say.
4. She pastes a key and closes Settings; the page re-reads itself (STORY-LEG-003).
5. If she instead clicks Ask agent and types "how do I set you up?", the run ends before any model call with the same Muse Spark message.

##### Variations
- Only an Anthropic key: Scan now is still disabled with the same warning (the resolved model is not Muse Spark 1.2, `api-legal.ts:88-96`), so the old "scan starts then fails" path is gone.
- User changed the Legal agent's model by hand: warning stays; `ensureLegalAgent` fills the model only when it is empty (`legal-agent.ts:84-97`).

##### Edge Cases
- The warning also shows while the model is merely unresolved (`!data.model?.isPreferred`, `Legal.tsx:133`).
- If the overview shows `model: null` because the AI resolver threw, the same warning appears (`api-legal.ts:52`).

#### STORY-LEG-003: Add the key in Settings and come back

**Type**: medium
**Topic**: Settings dependency
**Persona**: Maya, followed a teammate's advice to "just add an OpenRouter key"
**Goal**: See the warning go away and run the first scan
**Preconditions**: D0-nokey; a valid OpenRouter key to paste (the walk may use a test key; never print it).
**Ideal path**: 3 (open Models settings from the warning, paste the key, close; the page updates by itself)
**Alternate paths**: none found that sets the model from the Legal page.
**Source**: prior STORY-LEG-003

##### Steps
1. From `/app/legal`, Maya clicks **Open Models settings** and pastes a key.
2. She closes Settings. The page notices Settings closed and re-reads the overview and consent (`Legal.tsx:97-104`). The warning disappears.
3. The consent card appears (STORY-LEG-004) because a recipient now exists. **Hesitation:** "I already agreed to something in Settings; why again?" (Different consent: Settings key vs Data room documents.)
4. If she switched to another browser tab to copy the key from OpenRouter and came back, the page also re-reads on focus (`Legal.tsx:83-96`).
5. She clicks Allow, then Scan now.

##### Variations
- Settings was open in a different browser tab: the page only updates when this tab regains focus.

##### Edge Cases
- Bad key: not traced in this pass. The overview would still report a model but runs would fail; the failure shows as "Last scan failed: <reason>" (STORY-LEG-022).

#### STORY-LEG-004: The "Let the Legal agent read your documents" card

**Type**: short
**Topic**: Consent
**Persona**: Maya, careful about investor data in the Data room
**Goal**: Understand what is shared before clicking Allow
**Preconditions**: D0 with the model resolved; no Legal consent row.
**Ideal path**: 1 (read and click Allow)
**Alternate paths**: the Data room's own AI sharing control (a separate consent for the space's default model; Data room catalog).
**Source**: prior STORY-LEG-004

##### Steps
1. Maya reads the heading, the disclosure sentence and the recipient list (`ConsentPrompt.tsx:46-59`). **Hesitation:** "Does this include my board deck and cap table?" The card does not say which folders.
2. She looks for "Not now" or a link to details. Only **Allow** exists.
3. She clicks Allow. Pending state disables the button; on success the card vanishes with no message. Scan now becomes enabled.

##### Variations
- The providers changed since the page loaded: Allow gets a CONFLICT, the card is replaced by the current disclosure and Maya must click again, with no explanation (`ConsentPrompt.tsx:25-31`).
- Grant fails (network): a red line under the text with the error; Allow stays.
- No recipient yet (no model): no card at all, and Scan now says "Connect a model in Settings first." (`Legal.tsx:198`, `136-141`).

##### Edge Cases
- Later Maya wants to take the permission back: no control on Legal (S-LEG-08).
- Granting here also lets Data room items that were waiting for consent proceed (the grant goes through the Data room service, `api-legal.ts:188-217`). Nothing on the card says so.

#### STORY-LEG-005: First Scan now: "is it doing anything?"

**Type**: medium
**Topic**: Scanning
**Persona**: Maya, impatient, expects a progress bar
**Goal**: Know when the scan is finished and whether it worked
**Preconditions**: D0, consent granted, no previous scan.
**Ideal path**: 2 (click Scan now; the button says Scanning… and ends with a visible summary)
**Alternate paths**: wait for the daily scan (06:00 UTC, never mentioned on the page); ask the agent "scan my documents" in the panel (that is a chat run, not a scan, and does not change "Last scan").
**Source**: prior STORY-LEG-005

##### Steps
1. Maya clicks header **Scan now**. The request queues a run (`api-legal.ts:144-186`); the button reads "Scanning…" and is disabled; the Legal agent panel opens (`Legal.tsx:119-129`).
2. She watches the page: counts stay at zero for a while; no "3 of 9" progress. **Hesitation:** "Is it stuck?"
3. She reads the panel: the agent's tool activity lines ("Checking for unreviewed legal documents", "Recording a contract: ...", `legal-tools.ts:226-233`) and finally a short reply that lists deadlines due in 60 days first, then what was recorded, then any contracts found in mail or Drive (`LEGAL_SCAN_PROMPT`, `legal-agent.ts:16`).
4. When the run ends the page updates itself within 4 seconds: button back to "Scan now", "Last scan just now", tiles and tabs filled.
5. She clicks Scan now again "to be sure". A second run starts; it has nothing to read (Unreviewed is 0) and finishes quickly; nothing tells her it found nothing new except the panel reply.

##### Variations
- Panel already open when clicking Scan now: no visible change except the button (Ask agent is hidden while the panel is open).
- The scan takes longer than 5 minutes: the page stops polling and sets itself back to "Scan now" even if the run is still going (`Legal.tsx:109-112`); the next overview read (focus, reload) shows "Scanning…" again because the newest run is still running (`Legal.tsx:73`).

##### Edge Cases
- A scan already running (for example from the 06:00 routine): Scan now returns that run and does not start another (`api-legal.ts:149-159`); the daily wakeup also skips when a scan is running (`executor.ts:3254-3262`).

#### STORY-LEG-006: "Last scan 3 days ago": why not every day?

**Type**: short
**Topic**: Daily scan caption
**Persona**: Maya, returning after a long weekend
**Goal**: Trust that new documents are picked up without pressing anything
**Preconditions**: D1; the Daily legal scan routine paused, or its recent runs failed (set in the routine table for the walk).
**Ideal path**: 1 (the caption says "Daily scan paused" or "Last scan failed: reason")
**Alternate paths**: the routine is visible wherever the app lists routines for a bot (not traced).
**Source**: prior STORY-LEG-006

##### Steps
1. Maya opens Legal: "Last scan 3 days ago" (newest completed run of the agent's routine; Scan now runs count too, `api-legal.ts:41-45`).
2. She looks for "why". If the newest run failed, the caption instead reads "Last scan failed: <reason>" with a **Retry** button (`Legal.tsx:153-170`). If the routine is paused, nothing says so (S-LEG-07). No notification was sent (`notify: false`, `legal-agent.ts:49`).
3. She clicks Scan now; the caption updates by itself when the run ends.

##### Edge Cases
- A routine run that completes with zero documents still updates Last scan.
- A chat-triggered question does not change Last scan (trigger is `user`, not `routine`).

#### STORY-LEG-007: Monday morning legal check

**Type**: long
**Topic**: Routine use, all three tabs
**Persona**: Maya, now in week three, wants a five-minute "am I about to miss anything" check
**Goal**: Find anything due in the next month, handle what is already done, and confirm who the company is bound to
**Preconditions**: D2 (overdue "Q3 board consent signature" 2026-10-10, "Trademark office action response" 2026-11-14, "Renewal notice deadline" 2026-11-30, "Renews" 2027-01-31). Today = 2026-10-16.
**Ideal path**: 3 (open Legal, see a "due soon" list, mark one done); real path is 5 because the page opens on Contracts and Deadlines is a second click
**Alternate paths**: ask the agent "what's due this month?" (STORY-LEG-016); Inbox shows the emails themselves.
**Source**: prior STORY-LEG-007

##### Steps
1. Maya opens Legal. Tiles: Contracts 4, Active 3, Open deadlines 4, Overdue 1, Unreviewed documents 0. The default tab is **Contracts** (`Legal.tsx:65`).
2. She wonders "1 overdue, which one?" and clicks the Overdue tile. Nothing happens; tiles are not links (`Legal.tsx:202-206`, `Kpi` has an optional `to` that Legal does not pass). **Hesitation.**
3. She clicks **Deadlines**. List soonest first: "Q3 board consent signature" with a red pill "Overdue by 6 days" and the date in red; "Trademark office action response" with "Due in 29 days"; "Renewal notice deadline" with "Due in 45 days"; "Renews" in January with no urgency text (more than 30 days, `LegalDeadlines.tsx:16-17,118-127`). Dates read like "Nov 30, 2026" (`fullDay`).
4. She reads the grey line under the lease rows (contract title, a link) and the quote and note: "Derived from the expiration date and the notice period." appears as a note on derived rows (`legal-tools.ts:211`, `LegalDeadlines.tsx:147-151`). The same clause is shown under both "Renews" and "Renewal notice deadline".
5. She clicks **Done** on the board consent. The row disappears, a line appears at the top: "Marked Q3 board consent signature done." with **Undo** (`LegalDeadlines.tsx:71-82`). The Overdue tile drops to 0 after the page re-reads.
6. She opens the **Contracts** tab. "Next deadline" for the lease shows "Nov 30" (short form, year only when it is not the current year) while the Deadlines tab said "Nov 30, 2026" (`LegalContracts.tsx:104`, `finance-format.ts shortDay/fullDay`). Same fact, two formats.
7. She opens **Graph**: three columns of boxes, companies on the left, contracts in the middle, jurisdictions; clicks "Halcyon Logistics Mock" and reads "Halcyon Logistics Mock party to Master Services Agreement" plus the quote and an "Open document" link if the edge has one (`LegalGraph.tsx:199-232`).
8. She closes the tab. Next visit opens on Contracts again; the chosen tab is not remembered (`Legal.tsx:65`).

##### Variations
- Browser time zone east of UTC early in the morning: the tile and the row pills both use the viewer's date, so they agree (`Legal.tsx:143-145`, `LegalDeadlines.tsx:23`). The server's own overdue count is not shown.
- Maya switches to Contracts right after Done: the Undo line is gone (it lives in the Deadlines tab component).

##### Edge Cases
- Done fails (network): a red line "<error>" above the list; the row stays (`LegalDeadlines.tsx:96-100`).

### Stories: Contracts and documents

#### STORY-LEG-008: Open the lease from the table and come back

**Type**: medium
**Topic**: Data room link-through
**Persona**: Maya, wants to reread the renewal clause
**Goal**: Read the actual lease text and return to the same view
**Preconditions**: D2; lease contract linked to `MOCK Office Lease - 100 Placeholder Street.pdf`.
**Ideal path**: 2 (click the lease, read it, press Back to the same tab)
**Alternate paths**: the contract title link on a Deadlines row (`LegalDeadlines.tsx:131-140`); Data room > Legal folder directly; the "Open document" link in the graph's relation list.
**Source**: prior STORY-LEG-008

##### Steps
1. On the Contracts tab Maya clicks the lease title. URL `/app/data-room?item=<id>`; the Data room opens in the lease's folder with the preview open (`LegalContracts.tsx:70-75`, `DataRoom.tsx:192-213`).
2. She looks for the renewal sentence: whole document, no highlight.
3. She presses browser Back. Legal opens again on the **Contracts** tab regardless of the tab she came from (S-LEG-11).

##### Variations
- File deleted from the Data room after the scan: see STORY-LEG-028. If only the link is stale, the Data room opens with nothing selected and no message (`DataRoom.tsx:199-211`, `.catch(() => undefined)`, S-LEG-09).

#### STORY-LEG-009: What does "Unreviewed documents 9" mean?

**Type**: short
**Topic**: KPI tiles
**Persona**: Maya
**Goal**: Understand a number before trusting it
**Preconditions**: D0 after consent, before any scan.
**Ideal path**: 1 (a tooltip or link explaining it)
**Alternate paths**: none found.
**Source**: prior STORY-LEG-009

##### Steps
1. Maya sees "Unreviewed documents 9". She hovers: no tooltip. She clicks: nothing (`Legal.tsx:206`).
2. She compares with Data room > Legal holding 4 files and is confused: the count covers every ready Data room file in every folder (board deck, budget, roadmap), not only legal ones (`db/legal.ts:89-103`, S-LEG-01).
3. After the scan it reads 0, because the agent records even non-legal files as reviewed.

#### STORY-LEG-010: "Where is my board deck? It's not in the list." (documents judged not legal)

**Type**: medium
**Topic**: Documents marked not legal
**Persona**: Maya, expected the SAFE and the cap table to show up together
**Goal**: Check which files Legal ignored and include one it skipped
**Preconditions**: D1; five non-legal files recorded as `not_legal`. For the variation, the SAFE is wrongly recorded as `not_legal` (inserted for the walk).
**Ideal path**: 2 (open a "Skipped (5)" list, click "Review again" on one)
**Alternate paths**: ask the agent to re-read the file (it can re-record with `legal_upsert_contract`; not verified); upload a new version of the file in the Data room, which raises its revision so it counts as unreviewed again (`db/legal.ts:98`).
**Source**: prior STORY-LEG-010

##### Steps
1. The Contracts tab shows 4 rows. Maya counts 9 files in the Data room and wonders where the rest went.
2. She looks for a "not legal" or "skipped" list. None: `not_legal` rows are filtered out of the contract list (`db/legal.ts:12,169`).
3. Variation: the SAFE is missing. She looks for "Add contract" or "Mark as legal". None exists; contracts are written only by the agent (S-LEG-03).
4. She asks the agent "You missed the SAFE from Quill Capital" in the panel; the outcome depends on the model.

##### Edge Cases
- Uploading a new version of a skipped file re-queues it for the next scan.

### Stories: Deadlines

#### STORY-LEG-011: "What is due soon?"

**Type**: short
**Topic**: Deadlines read
**Persona**: Maya
**Goal**: See the next 30 days at a glance
**Preconditions**: D2.
**Ideal path**: 2 (open Legal, click Deadlines; rows within 30 days say "Due in N days")
**Alternate paths**: ask the agent (the scan reply lists 60-day deadlines first); Contracts tab "Next deadline" column.
**Source**: prior STORY-LEG-011

##### Steps
1. Maya opens Legal. It lands on Contracts, not Deadlines (`Legal.tsx:65`). She scans the Next deadline column.
2. She clicks Deadlines. Rows due in 30 days or less say "Due today", "Due tomorrow" or "Due in N days"; further ones show only the date (`LegalDeadlines.tsx:118-127`). Old complaint P-16 is fixed for the 30-day window; a deadline 45 days away has no marker.

#### STORY-LEG-012: Done vs Dismiss, and clicking the wrong one

**Type**: short
**Topic**: Deadlines write
**Persona**: Maya, on a laptop trackpad
**Goal**: Mark the trademark response as handled by the lawyer, not as irrelevant
**Preconditions**: D2.
**Ideal path**: 1 (click Done; Undo is offered)
**Alternate paths**: none other.
**Source**: prior STORY-LEG-012

##### Steps
1. Maya reads two buttons on each row: **Done** (outlined) and **Dismiss** (plain). **Hesitation:** "Dismiss like a notification, or delete?" No hint text (`LegalDeadlines.tsx:159-178`).
2. She clicks Dismiss by mistake. The row disappears; a line reads "Dismissed Trademark office action response." with **Undo** (`LegalDeadlines.tsx:71-82`).
3. She clicks Undo within 8 seconds (`UNDO_MS`). The row returns (status set back to open).
4. If she waits longer, the Undo disappears and the item is gone from every tab: only open deadlines are listed (`api-legal.ts:37`). There is no closed list (S-LEG-06).

##### Edge Cases
- Closing a second row replaces the Undo for the first; the first can no longer be undone.
- Switching tabs before undoing loses the Undo line.
- Undo fails (network): red line above the list.

#### STORY-LEG-013: The lease gets renewed: do the dates move?

**Type**: medium
**Topic**: Derived deadlines after a document change
**Persona**: Maya, signed the renewal and uploaded the amended lease
**Goal**: See the next renewal and notice dates for the new term
**Preconditions**: D2, with "Renewal notice deadline 2026-11-30" already marked Done. A new revision of the lease stating expiry 2029-01-31 is uploaded to the Data room.
**Ideal path**: 2 (upload the new lease, see new dates after a Scan now)
**Alternate paths**: tell the agent the new dates in chat.
**Source**: prior STORY-LEG-013

##### Steps
1. Maya uploads the amended lease in Data room > Legal.
2. She returns to Legal. Unreviewed documents shows 1 (revision is higher than the analyzed one, `db/legal.ts:98`). She clicks Scan now and waits for "Scanning…" to end.
3. Contracts row shows the new term. Deadlines now shows "Renews Jan 31, 2029" and a new "Renewal notice deadline" for the new date: the old closed row stays closed for its own date, and the changed date opens a new row (`legal-tools.ts:393-410`). The old gap (no new reminder after a Done) is fixed.

##### Variations
- The notice row had been left open: it moves to the new date (same row id).
- The agent forgets `renewalQuote`: derived rows show no quote.

##### Edge Cases
- If `autoRenews` flips, the open "Renews" row is dismissed with a note and "Expires" opens (`legal-tools.ts:387-392`); the note is not visible anywhere.

### Stories: Graph

#### STORY-LEG-014: "Who are we actually signed with?"

**Type**: short
**Topic**: Graph
**Persona**: Maya, prepping for a board meeting
**Goal**: List the companies Northwind has contracts with
**Preconditions**: D2 graph rows.
**Ideal path**: 1 (a list of counterparties)
**Alternate paths**: Contracts tab "Parties" column (simpler, same fact); ask the agent.
**Source**: prior STORY-LEG-014

##### Steps
1. Maya clicks Graph. Columns of boxes: Company, Person, Jurisdiction, Contract, ... in a fixed order, headed by their kind (`LegalGraph.tsx:14-23,123-133`). Below: "Select an item to see its relations." No legend.
2. She clicks "Quill Capital Mock". The box outlines; the heading and "Quill Capital Mock party to SAFE" appear under the diagram, with the source quote and, when the edge knows its document, an **Open document** link (`LegalGraph.tsx:199-232`). Relations are shown as words ("party to"), not the stored "party_to".
3. She tries to click the SAFE box to open it: that selects the box; no link from the box itself.
4. She clicks the same box again to deselect (the only way).

##### Edge Cases
- Empty graph: "No relationships yet." with no next step (`LegalGraph.tsx:91-97`).
- Labels longer than 27 characters are cut with an ellipsis (`LegalGraph.tsx:45`); the full label shows after selecting.

#### STORY-LEG-015: Big graph, cannot find a party

**Type**: medium
**Topic**: Graph cap
**Persona**: Maya, a year later, 60 contracts
**Goal**: Find one supplier on the graph
**Preconditions**: D2 plus at least 150 extra synthetic MOCK nodes and edges.
**Ideal path**: 2 (type the name in a filter, select it)
**Alternate paths**: Contracts tab Parties column; ask the agent.
**Source**: prior STORY-LEG-015

##### Steps
1. Graph shows "Showing the 120 most connected of 160 items." (`LegalGraph.tsx:108-114`, cap 120). The server itself returns at most 2000 nodes (`db/legal.ts:15`).
2. She looks for search: none. Ctrl+F finds only drawn labels, cut at 27 characters.
3. She falls back to the Contracts table, which also has no search.

### Stories: Legal agent

#### STORY-LEG-016: Ask the agent "what do we owe this month?"

**Type**: short
**Topic**: Agent conversation
**Persona**: Maya
**Goal**: Get a plain answer about payments and obligations
**Preconditions**: D2; model resolved; consent granted.
**Ideal path**: 2 (open the panel, ask)
**Alternate paths**: Deadlines tab; Finance page for payments.
**Source**: prior STORY-LEG-016

##### Steps
1. Maya clicks **Ask agent**. A panel opens with the Legal agent's thread (and, if the agent bot does not exist yet, a **Create Legal agent** button, `Shell.tsx:4261`).
2. She types the question. The agent uses `legal_query` and replies briefly. The "not a lawyer" rule is only in its instructions (`legal-agent.ts:12`), not on the page (S-LEG-15).
3. She asks "So should I sign the Halcyon redlines?" The agent should decline legal advice; the page itself shows no disclaimer.

##### Edge Cases
- Consent withdrawn or missing: the run ends before any model call with "Data Room consent is required for OpenRouter before the Legal agent can run. Allow it on the Legal page." (`executor.ts:3892-3896`).

#### STORY-LEG-017: A quarter of running the company on Legal

**Type**: long
**Topic**: End-to-end over time
**Persona**: Maya, now relying on Legal instead of a spreadsheet
**Goal**: Never miss the lease notice, the trademark response, or a recurring obligation over three months
**Preconditions**: D2 plus a recurring deadline "Annual Delaware franchise tax report" due 2027-03-01 recorded by the agent. The walk simulates time by moving the browser clock or editing due dates.
**Ideal path**: 6 (weekly visit, Done on each item as handled, new items appear by themselves)
**Alternate paths**: daily scan replies in the Legal agent thread; email reminders do not exist (`notify: false`).
**Source**: prior STORY-LEG-017

##### Steps
1. Week 1: open Legal, Deadlines tab, read four items (STORY-LEG-007).
2. Maya marks the trademark response Done when counsel files it.
3. Week 3: a forwarded email from the landlord arrives in Inbox. Maya expects Legal to know. Mail findings are only reported in the agent's chat reply, not recorded as deadlines or added to the Data room (`legal-agent.ts:12`, S-LEG-04).
4. Week 6: the notice deadline 2026-11-30 approaches. The row shows "Due in N days" within 30 days (good); no notification is sent.
5. Maya sends the notice and clicks Done on "Renewal notice deadline".
6. She uploads the signed renewal (STORY-LEG-013): a new notice row appears for the new term.
7. March: she marks the franchise tax report Done. At the next scan (daily 06:00 UTC), step 3 of the scan prompt records the next occurrence if the model follows it (`LEGAL_SCAN_PROMPT`). Hypothesis, not observed: a 2028 row appears.
8. She checks "Last scan" each week; if the routine had been paused nothing on the page said so (S-LEG-07).
9. End of quarter: she wants a list of what was done. No closed or history view exists (S-LEG-06).

##### Variations
- Maya works from a phone: STORY-LEG-024.

#### STORY-LEG-018: Contracts that are only in email

**Type**: medium
**Topic**: Mail findings
**Persona**: Maya, who keeps signed PDFs as email attachments
**Goal**: Get the MSA redlines and the trademark notice into Legal
**Preconditions**: D1; Gmail emulator seeded (the four legal emails); the Legal agent's mail tools available (owner's own non-group run, `legal-tools.ts:29-42`).
**Ideal path**: 2 (agent lists the emails, Maya clicks "Add to Data room")
**Alternate paths**: Data room "import from email" and "import from Drive" (new in the same PR; Data room catalog); Inbox page.
**Source**: prior STORY-LEG-018

##### Steps
1. Maya clicks Scan now. The agent's reply includes "found in mail: Office lease renewal option, Legal notice: trademark office action..." (expected from scan step 2).
2. She looks for an "Add" button in the reply. None; the agent "cannot add them to the Data Room" (`legal-agent.ts:12`).
3. She goes to Data room and uses its import-from-email control (separate feature), returns, scans again.
4. The trademark notice is an email, not a contract; it may be recorded as not legal or as a contract with no dates. The 30-day response date lives only in the email body.

#### STORY-LEG-019: Two legal bots: "Legal Desk (mock)" vs "Legal agent"

**Type**: short
**Topic**: Agent identity
**Persona**: Maya, sees bots in the sidebar roster
**Goal**: Talk to "the legal one"
**Preconditions**: D0 after visiting Legal once. Seeded bot "Legal Desk (mock)", title "Contracts", is also in the roster and in the group "Leadership sync (mock)".
**Ideal path**: 1 (one obvious legal assistant)
**Alternate paths**: Legal page **Ask agent** panel (the real Legal agent); roster "Legal agent"; roster "Legal Desk (mock)" (ordinary bot, no legal tools); group chat (the Legal agent loses its legal tools in groups, `legal-tools.ts:29-42`).
**Source**: prior STORY-LEG-019

##### Steps
1. Maya sees "Legal Desk (mock) - Contracts" in the roster and asks "when does my lease renew?" An ordinary bot answers without `legal_query` or the Legal page's data.
2. She also sees "Legal agent" (created by visiting `/app/legal`, description "Reads your contracts and tracks legal deadlines.", `legal-agent.ts:75`) and cannot tell which one feeds the Legal page.
3. Answers can differ; nothing on either says which one is "real".

### Stories: Advanced and failure

#### STORY-LEG-020: The Legal tab is not there

**Type**: long (it gates every other story)
**Topic**: Build contents
**Persona**: Maya, told "click Legal in the sidebar"
**Goal**: Reach the Legal page
**Preconditions**: Demo account built from `origin/main` or `docs/ux-pass` (559a76ad). True until PR #109 merges.
**Ideal path**: 1 (click Legal)
**Alternate paths**: type `/app/legal` in the address bar.
**Source**: prior STORY-LEG-020

##### Steps
1. The sidebar shows Inbox, Finance, Cap Table, Data room, Integrations; no Legal.
2. Maya types `/app/legal`. The route does not exist on this branch (no Legal files are tracked on `docs/ux-pass`); she lands wherever unknown paths go.
3. She opens Data room > Legal folder: four PDFs, no contract view, no dates.
4. She asks Chief "track my contract deadlines": an ordinary chat answer; nothing is recorded.
5. Walker: stop and report that the build lacks feat/legal; run STORY-LEG-001 onwards only on a build that contains f2b8fc1e or later.

##### Variations
- Build contains Legal but with an older commit (for example 488048d5): the one-line warning has no button, there is no polling, no Undo, no Retry. Use the commit to decide which stories apply.

### Stories: New since the previous catalog

#### STORY-LEG-021: Empty page before the first scan

**Type**: short
**Topic**: Empty state
**Persona**: Maya, just allowed access, nothing scanned
**Goal**: Know what to do next
**Preconditions**: D0, consent granted, model ready, no legal rows.
**Ideal path**: 1 (click Scan now)
**Alternate paths**: ask the agent.
**Source**: new

##### Steps
1. Maya sees the title, "Not scanned yet", the five tiles at zero (Unreviewed 9) and the sentence "The Legal agent scans your Data room for contracts and deadlines." (`Legal.tsx:208-213`). There are no Contracts / Deadlines / Graph tabs.
2. She looks for a button in the middle of the page. There is none (the old centre button was removed; a test asserts a single Scan now on an empty page, `Legal.test.tsx` "has one Scan now button on an empty page").
3. She notices Scan now in the header and clicks it (STORY-LEG-005).

##### Variations
- Consent not granted yet: the same page shows the card above the tiles and Scan now is greyed with "Allow access below first."

##### Edge Cases
- After a scan that finds nothing legal (all files not_legal): contracts and deadlines are both empty, so the page looks exactly like "never scanned" except "Last scan just now" (S-LEG-10 variant: no "nothing found" message).

#### STORY-LEG-022: A scan fails, and Retry

**Type**: medium
**Topic**: Scan failure
**Persona**: Maya, key pasted wrong, or consent withdrawn
**Goal**: Understand what failed and recover
**Preconditions**: D0, model resolves but the newest scan run is `failed` (insert a failed routine run with error "Data Room consent is required.", or use a key that errors).
**Ideal path**: 2 (read the reason, click Retry)
**Alternate paths**: open the panel and read the failure message; fix in Settings.
**Source**: new

##### Steps
1. Maya opens Legal. The caption reads "Last scan failed: Data Room consent is required." and a **Retry** button sits next to it (`Legal.tsx:153-170`). Scan now is also available.
2. She does not know what "Data Room consent" is; the reason text is the run's raw error. **Hesitation.**
3. If consent is the cause, the card is also visible and she clicks Allow; Retry becomes enabled (it is disabled while `needsConsent`, `Legal.tsx:167`).
4. She clicks Retry: button reads "Scanning…", panel opens, caption returns to "Last scan ..." on success.

##### Variations
- Scan now itself errors at queue time (for example space deleted): a red line under the header with the error (`Legal.tsx:193-197`).
- Panel shows the same text as a bot message ("The Legal agent runs only on Muse Spark 1.2...").

##### Edge Cases
- Cancelled run: treated as not running; caption falls back to "Last scan ..." from the last completed one.

#### STORY-LEG-023: Leave during a scan, come back

**Type**: short
**Topic**: Running state across navigation
**Persona**: Maya, impatient, opens Inbox while it scans
**Goal**: Find out whether the scan finished
**Preconditions**: D0, consent granted, a scan running.
**Ideal path**: 1 (return to Legal and see the result)
**Alternate paths**: the roster's Legal agent bot shows its status.
**Source**: new

##### Steps
1. Maya clicks Scan now, then Inbox in the sidebar. The panel closes (`Shell.tsx:881`); the run continues.
2. She returns to Legal 2 minutes later. The overview shows the newest run's status; if still running the button reads "Scanning…" and the page polls again (`Legal.tsx:71-73,105-117`); if finished, the numbers are already there.
3. She sees no message saying what the scan found; the panel (closed) has the summary. She must click Ask agent to read it.

##### Edge Cases
- The panel does not reopen by itself.

#### STORY-LEG-024: The Monday check on a phone

**Type**: medium
**Topic**: Phone width
**Persona**: Maya, on a 390 px phone in a taxi
**Goal**: See what is due this week
**Preconditions**: D2; viewport 390 x 844.
**Ideal path**: 3 (open menu, Legal, Deadlines)
**Alternate paths**: ask the agent.
**Source**: new

##### Steps
1. Maya opens the sidebar (mobile drawer), taps Legal; the drawer closes (`Shell.tsx:3385-3389`).
2. Tiles are two per row (`grid-cols-2`, `Legal.tsx:201`), so five tiles stack in three rows. The header wraps: title, caption, then Scan now and Ask agent.
3. She taps Deadlines. Rows wrap: title and urgency, then date and the two buttons (`LegalDeadlines.tsx:107-111`). Readable.
4. She taps Contracts: the table needs a 820 px width and scrolls sideways (`LegalContracts.tsx:34-35`). **Hesitation:** she may miss the Term, Renewal, Value and Next deadline columns because they are off screen.
5. She taps Graph: the diagram is at least 640 px wide and scrolls sideways (`LegalGraph.tsx:115,121`).
6. She taps Ask agent: the side panel has a minimum width of 320 px (`ResizableSidePanel.tsx`); how it sits over a 390 px page was not read, so this is unverified.

##### Variations
- Landscape phone: same as desktop below the `@3xl` breakpoint; five tiles may still be two columns.

#### STORY-LEG-025: The page fails to load, or a refresh fails mid-scan

**Type**: medium
**Topic**: Load failure
**Persona**: Maya, on a weak connection
**Goal**: Get her dates back
**Preconditions**: D2; network blocked for the overview request.
**Ideal path**: 1 (click Try again)
**Alternate paths**: reload the browser.
**Source**: new

##### Steps
1. Maya opens Legal with the network down. After the skeleton: a red line with the error text and **Try again** (`Legal.tsx:131`, `ErrorNotice`). Nothing else shows (not the header, not Scan now).
2. She reconnects and clicks Try again; the page loads.
3. Variation (mid-scan): during the 4-second polling the connection drops for one request. `useFinanceQuery` keeps the old data but sets the error, and `if (overview.error) return <ErrorNotice>` replaces the whole page with the error (S-LEG-10). The Scanning state is lost until she clicks Try again.
4. The same can happen on window focus or after closing Settings, because those also re-read the overview (`Legal.tsx:83-104`).

##### Edge Cases
- A failed consent read does not hide the page (`Legal.tsx:62-63`); the card just does not show and Scan now stays enabled until the agent reports the problem.
- A failed graph read shows its own error and Try again inside the Graph tab (`Legal.tsx:240-245`).

#### STORY-LEG-026: Hide amounts is switched on

**Type**: short
**Topic**: Privacy preference
**Persona**: Maya, screen-sharing with an investor
**Goal**: Show deadlines without showing contract values
**Preconditions**: D2; Hide amounts is on (set elsewhere in the app; the Legal page has no toggle).
**Ideal path**: 1 (values are masked everywhere on the page)
**Alternate paths**: none.
**Source**: new

##### Steps
1. Maya opens Contracts. The Value column is masked (`LegalContracts.tsx:101`, `hiddenOr`).
2. She opens Deadlines. Quotes and notes are run through the currency masker, so "$7,500 a month" is hidden (`LegalDeadlines.tsx:144,149`).
3. She opens Graph and selects an edge: its quote is masked too (`LegalGraph.tsx:217`). Node labels and attrs are not masked, so an amount in a node label would show.
4. She wants to turn it off: there is no toggle on the Legal page (S-LEG-12 variant).

##### Edge Cases
- The agent's chat replies in the panel are not masked by the Legal page.

#### STORY-LEG-027: Keyboard only

**Type**: medium
**Topic**: Keyboard and screen reader
**Persona**: Maya, uses the keyboard, sometimes a screen reader
**Goal**: Complete the Monday check without a mouse
**Preconditions**: D2.
**Ideal path**: 6
**Alternate paths**: none found.
**Source**: new

##### Steps
1. Tab through the sidebar to Legal and press Enter. The page opens.
2. Tab to the tab list; the three tabs are a tab group labelled "View" (`Legal.tsx:217`). Arrow keys move between them (standard tabs behaviour, not tested in this pass).
3. On Deadlines, each row's buttons are named "Mark <title> done" and "Dismiss <title>" (`LegalDeadlines.tsx:164,173`). She presses Enter on one; the status line "Marked ... done." with Undo appears as a polite status (`role="status"`). Focus is not moved to the Undo button.
4. On Graph, each box is a button with the label "Company: Quill Capital Mock" (`LegalGraph.tsx:160-161`); Enter or Space selects, same again deselects. The relations list appears under the diagram.
5. A screen reader reads the diagram as a group "Legal relationships"; edges carry hover titles but are not focusable.
6. Contracts table has an invisible caption "Contracts" (`LegalContracts.tsx:36-38`).

##### Edge Cases
- After Done the focused button is removed from the page, so focus falls back to the page body.

#### STORY-LEG-028: Deleting the lease file in the Data room

**Type**: medium
**Topic**: Cross-feature consequence
**Persona**: Maya, tidying the Data room
**Goal**: Remove a duplicate lease PDF
**Preconditions**: D2; lease contract with two deadlines and graph nodes linked to its Data room item.
**Ideal path**: 2 (delete the file; Legal warns what will disappear)
**Alternate paths**: none.
**Source**: new

##### Steps
1. Maya opens Data room > Legal, finds the lease and deletes it (Data room flow; its confirm text was not read for this pass).
2. She returns to Legal. The lease row is gone from Contracts, "Renews" and "Renewal notice deadline" are gone from Deadlines, the lease and its edges are gone from the Graph (foreign keys cascade from the Data room item to the contract, to deadlines linked to that contract, and to nodes of that contract, `migration.sql:113-128`; `d8642a65`). A manual deadline attached to the lease's contract also goes.
3. Nothing on Legal says why. **Hesitation:** "Did the app lose my renewal date?"

##### Edge Cases
- Undoing the delete in the Data room, if offered, is not known to restore Legal data.
- Deadlines linked only to a Data room item but not a contract do not cascade; their title link then goes to an item that no longer exists (S-LEG-09).

#### STORY-LEG-029: A contract ends, and its reminders disappear

**Type**: short
**Topic**: Derived deadlines on status change
**Persona**: Maya, terminated the NDA with Acme Ventures
**Goal**: Stop being reminded about it
**Preconditions**: D2 plus an NDA with an open derived "Expires" row.
**Ideal path**: 2 (tell the agent, reminder disappears)
**Alternate paths**: click Dismiss on the row.
**Source**: new

##### Steps
1. Maya opens the panel and tells the agent "We terminated the Acme NDA on October 1."
2. The agent may call `legal_upsert_contract` with status `terminated`. Hypothesis: it does; this is model-dependent.
3. If it does, the open derived rows for that contract are dismissed with the note "Dismissed: the contract no longer has this date." (`legal-tools.ts:365-392`). The row leaves the Deadlines tab; the Contracts row shows Status "Terminated".
4. If it does not, the reminder stays. Maya can click Dismiss herself (STORY-LEG-012).

##### Edge Cases
- Manual deadlines on the contract are never touched.

### Redundancy Candidates (this area)

- Scan now exists in the header and Ask agent can also run a scan by asking in chat; they differ (a chat run does not change "Last scan"), which Maya cannot know.
- "Parties" in Contracts and companies in Graph show the same fact in two places; Graph adds quotes and document links.
- "Next deadline" on Contracts duplicates the Deadlines tab, in a shorter date format.
- "Legal agent" (created by visiting Legal) and the seeded "Legal Desk (mock)" overlap in purpose (STORY-LEG-019).
- The Data room consent and the Legal consent are the same underlying consent for different recipients, shown in two places with different wording.

### Suspected problems (this area)

IDs below are stable for this catalog; all are read from code, none observed in a browser.

- **S-LEG-01** Unreviewed documents tile counts every ready Data room file in all folders (`db/legal.ts:89-103`, `api-legal.ts:39`); first-time reading "9" with four contracts is confusing and the tile has no explanation or link.
- **S-LEG-02** (hypothesis) The seed PDFs state "31 January" and "30 November" without a year; the agent is told never to invent a date, so the first scan may produce no deadlines and a dashed table.
- **S-LEG-03** `not_legal` rows are filtered out (`db/legal.ts:12,169`); there is no skipped list, no "Mark as legal", no "Add contract". A wrong judgement can only be fixed by chatting or re-uploading.
- **S-LEG-04** Contracts and deadlines found only in mail or Drive are reported in the chat reply and never recorded (`legal-agent.ts:12`); the Legal page cannot show them.
- **S-LEG-05** The page's Unreviewed count is not filtered by denied connections (`api-legal.ts:39`) while the agent's own list is (`legal-tools.ts:252-253`). A file imported through a denied connection could keep the tile above zero forever. Hypothesis from code; needs a denied connection to confirm.
- **S-LEG-06** No history: once Done or Dismissed (after the 8-second Undo, `LegalDeadlines.tsx:15`) a deadline cannot be seen or reopened from the UI; a second close replaces the first Undo; switching tabs drops the Undo.
- **S-LEG-07** Nothing on the page says the scan runs daily at 06:00 UTC (`legal-agent.ts:19`); a paused or disabled routine is invisible; no notification is sent (`notify: false`, `legal-agent.ts:49`).
- **S-LEG-08** Consent card has no Not now, no list of folders, no way to review or revoke it on Legal (`ConsentPrompt.tsx`); granting also releases waiting Data room items (`api-legal.ts:188-217`) without saying so.
- **S-LEG-09** `DataRoom.tsx:199-211` swallows a failed lookup of the linked item (`.catch(() => undefined)`), so a stale link opens the Data room with nothing selected and no message.
- **S-LEG-10** A failed re-read replaces the whole Legal page with the error (`Legal.tsx:131` with `useFinanceQuery` keeping data but setting `error`); this includes the 4-second scan poll, window focus and closing Settings. Also: a scan that finds nothing leaves the page looking exactly like "never scanned" (`Legal.tsx:208`).
- **S-LEG-11** The selected tab is local state (`Legal.tsx:65`), so Back from the Data room, a reload or a revisit always lands on Contracts.
- **S-LEG-12** Deleting a Data room document silently deletes its contract, linked deadlines (including manual ones) and graph nodes through cascading foreign keys (`migration.sql:113-128`, commit `d8642a65`); Legal gives no warning or trace. The Legal page has no Hide amounts toggle even though it masks values.
- **S-LEG-13** Graph: no legend, no search, labels cut at 27 characters, boxes do not link to their document (only relation rows do), deselect only by clicking the same box again.
- **S-LEG-14** Date formats differ between tabs: "Nov 30" (Contracts, `shortDay`) vs "Nov 30, 2026" (Deadlines, `fullDay`).
- **S-LEG-15** The "Ask agent" button does not name the Legal agent; it disappears while the panel is open; and the page shows no "not legal advice" notice (only the agent's instructions say it).
- **S-LEG-16** (hypothesis) The Legal agent's tool list includes `web_search`, `web_fetch` and the memory tools (`contracts/legal.ts` `LEGAL_AGENT_BUILTIN_TOOLS`), but the consent card describes only document text going to the model provider. Whether contract facts can reach a web query or saved memory was not traced.


---

## Area: Cap Table (STORY-CAP-nnn)

Source: `docs/ux-paths/captable/catalog.md`.

Generated: 2026-10-17 (read from `docs/ux-pass` at 559a76ad)
Scope: Cap table page (`/app/cap-table`), the Carta connection (in-place sign-in and Integrations), the Carta agent side panel, contacts, the Refresh/Reading states, Hide amounts, phone width, and how the sidebar reaches the page.
Total Stories: 33 (short 21, medium 7, long 5)

### Changes since the 2026-10-16 catalog

The page was rebuilt on 2026-10-16/17 (commits 26af3c67, 942a011a, f336e9fa, 7a5a0b05, 37c9108b, 7524256c and others). It now shows a real cap table, and it no longer sends the founder away to connect Carta. Most 2026-10-16 steps were wrong and are rewritten.

- **Kept (id unchanged, steps rewritten to match the code):** 001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020. Every one still applies in spirit; only these premises changed:
  - 001/002: the page is no longer "just a contact list". It has a "See who owns your company" card when Carta is off, and a summary, ownership bar and holdings table when Carta is on. Nav label is "Cap table" (sentence case). Tabs persist in the URL (`?kind=`).
  - 003/004/005: "Connect Carta" opens a sign-in dialog on top of the page (`ConnectCartaDialog`, `CapTable.tsx:186-210`); it no longer navigates to Integrations. Expired sign-in shows "Reconnect Carta" with its own headline.
  - 006/007/008: there is no "Create Carta agent" button. The agent is created automatically once Carta is connected (`lib/carta-agent.ts:37-70`, `Shell.tsx:2665-2671`). The panel never opens empty and only opens while Carta is connected. The collapsed choice is now remembered per user and the panel starts collapsed on a phone. The reopen button is the shared "Ask" button (`AskBotButton.tsx`), not a "Show Carta agent" icon.
  - 011: duplicate email no longer overwrites silently. It shows "Another contact already has this email." plus an "Open <name>" button (`CapTable.tsx:355-371`).
  - 012: kind tabs are in the URL; an empty tab says "No auditors yet" with an "Add auditor" button.
  - 013: Delete now has an 8 second "Deleted <name>" toast with Undo, and a failed Undo stays until retried or dismissed.
  - 014/015/016: the agent first reads what the page already shows (`cap_table_read`), saves figures with `cap_table_update`, and `contacts_add` needs no approval card. Only `contacts_save` (changing an existing contact) shows "Save contact “…”". The table now reloads by itself when a sync ends.
  - 017: rewritten around auto sync: connect, "Reading Carta…", then the table fills in.
  - 018/019/020: skills and Gmail flows unchanged; hide-amounts, Ask panel and approval wording updated.
- **Dropped:** none. (2026-10-16 premises "the page shows no cap table" and "Create Carta agent button" were removed from 001/006; the stories remain.)
- **Added:** 021 to 033, for behaviour that did not exist before:
  - 021 Hide amounts on Cap table; 022 phone width, Carta off; 023 phone width, Carta on; 024 first read cannot start (no model); 025 Refresh from Carta; 026 cap table load failure and servers-list failure; 027 "Allow changes in Carta" switch; 028 reaching the page by search, palette and the Integrations card; 029 "Add email" on a holder; 030 founders, options and investors in the table and tabs; 031 failed Undo; 032 a sync started elsewhere (another tab); 033 long board-prep sitting with Hide amounts.

### What actually exists (read before walking)

- **The page has two modes** (`CapTable.tsx:581-875`).
  - *Carta not connected:* heading "Cap table", icon buttons Hide amounts (eye), then "Add contact" (outline button); a card titled "See who owns your company" ("Sign in to Carta again to see who owns your company" when a Carta server exists but needs sign-in) with text "Ownership comes from Carta. Connect it to see holders, the option pool and SAFEs here. The Carta agent can answer questions about them only while Carta is connected." and a "Connect Carta" ("Reconnect Carta") button; kind tabs; the contacts table. No Refresh button, no Ask button, no side panel (`CapTable.tsx:621-643`, `Shell.tsx` `cartaPanelState`).
  - *Carta connected:* header gets a Refresh (circular arrows, label "Refresh from Carta"), "Add contact" turns to the primary button, and an "Ask" button appears when the panel is collapsed and an agent exists. After the agent has saved a snapshot: company name and "Updated <relative time>", four figure cards (Fully diluted shares, Option pool available, Latest 409A, Amount raised), an ownership bar with a legend per share class, and a table with Name, Email, Kind, Shares, Ownership.
- **The table joins two sources** (`joinRows`, `CapTable.tsx:77-108`): Carta holders (matched to a contact by email), an "Unallocated pool" row right after the granted options, then contacts with no holding. Holders with no contact are plain text (not clickable). Only contact names are buttons that open "Edit contact".
- **Kinds shown:** Investor, Auditor, Other (contacts) plus Shareholder and Options for holders with no contact. A holder with no contact is classed Options if the security contains "option", Investor if it looks like SAFE/preferred/series/note/convertible/warrant, else Shareholder (`rowKind`, `CapTable.tsx:69-75`).
- **Carta is connected in place.** "Connect Carta" opens a dialog over the page, titled for Carta, with only the sign-in step (step 1 of 2) and then "Carta connected / The Carta agent can now read your cap table. / Done" (`CustomConnectionDialog.tsx:787, 815`). Integrations has a Carta tile ("Cap table, equity and investors") and a connected Carta card shows "Open Cap table" (`IntegrationsHome.tsx:146`).
- **Sign-in starts a read by itself.** When a Carta server finishes OAuth the API creates the Carta agent and queues one run that reads Carta, saves the cap table, adds investor holders as contacts and searches mail (`carta-agent.ts:16, 135-193`). With no model set up it silently does nothing (returns `no_model`).
- **Refresh** calls `rpc.carta.refresh` (needs a connected Carta server, else "Connect Carta first"; with no model, "Add a model before refreshing") and the page polls every 3 s while the run is active, every 30 s when idle and on window focus (`CapTable.tsx:505-522`). Contacts reload when a run ends.
- **The agent** ("Carta agent", spawn key `carta-agent:<userId>`) has a fixed Carta tool list, read-only unless the Carta server's "Allow changes in Carta" switch is on (then `mutate` and `call_tool` are added and each call asks first; `contracts/src/carta.ts:30-46`, `McpDetail.tsx:175-197, 254-266`). It also has `cap_table_read`, `cap_table_update`, `contacts_list`, `contacts_add` (no approval) and `contacts_save` (approval card "Save contact “<name>”", `approval-ask.ts:138`; listed in `action-approval.ts:45`). Carta tools belong to this agent alone (other bots get "Carta is used only by the Carta agent.", `router.ts:548`).
- **The side panel** (`Shell.tsx:2615-2730, 4378-4440`): header has the agent name (opens the bot's own page) and "Collapse Carta agent". An empty chat shows "The Carta agent reads your cap table from Carta and answers questions about it. Try one:" with two suggestions: "Who are our investors?" and "Draft this month's investor update". If creation fails, the panel shows the error and a "Try again" button.
- **Sidebar:** "Cap table" is a fixed page row between "Finance" and "Data room" (`Shell.tsx:3501-3510`, test id `sidebar-cap-table`). It cannot be hidden or removed: the optional "sidebar pages" feature offers only a `team-health` template, which is unavailable (`contracts/src/sidebar-pages.ts:4-13`). The sidebar search box ("Search chats") also lists app pages by name, including "Cap table" (`Shell.tsx:1788-1803`).
- **Hide amounts** (eye button in the page header; also in the account menu; saved in the browser): masks Fully diluted shares, Option pool available, Latest 409A, Amount raised, Shares and Ownership columns, the legend percentages and any dollar amount in a holding label as `•••` / `$•••` / `•••%` (`finance-format.ts:185-204`). It does not mask names, emails, share class names, or the ownership bar's segment widths. Tooltip: "Hides amounts on finance screens and masks currency amounts in chat text. Plain numbers in agent replies may still show."
- **Not built (do not walk as features):** a pie chart (the bar is the only graphic), a "last synced" error banner, contact search on the page, bulk import, any write to Carta without the switch, routine suggestions for audit season.

### Mock demo data (seed once for the whole catalog)

Company / space name: **Northwind Robotics**. Signed-in founder: "Maya Chen" (`maya@northwind-robotics.test`), onboarding complete, a model set up unless a story says otherwise.

| Seed set | Contents |
|---|---|
| `contacts-base` | Investors: "Priya Raman", priya@sequoia-mock.test, "Sequoia Mock Capital"; "Tom Okafor", tom@lighthouse-mock.test, "Lighthouse Mock Ventures"; "Lena Fischer" (angel), lena.fischer@mock.test, no organization. Auditor: "Daniel Ortiz", dortiz@kpmg-mock.test, "KPMG Mock (auditor for Lighthouse Mock Ventures)". Other: "Sam Lee", sam@cooley-mock.test, "Cooley Mock LLP", notes "Company counsel". |
| `contacts-empty` | No contacts. |
| `carta-none` | No MCP server with a Carta endpoint. |
| `carta-connected` | Enabled MCP server with endpoint `https://mcp.app.carta.com/mcp`, OAuth status `connected`. Carta is matched by host, so the walk needs a Carta sandbox account or a stub reachable at that host. |
| `carta-needs-auth` | Same server row, enabled, OAuth expired (status not `connected`). |
| `snapshot-none` | `carta-connected` but nothing saved yet (agent has not read Carta). |
| `snapshot-fixture` | Saved snapshot: "Northwind Robotics", as of 2026-09-30; fully diluted 10,000,000; amount raised $1,050,000; option pool available 900,000; latest 409A $0.42 (2026-06-30). Share classes: Common 70%, Preferred 10%, Options 15%, SAFEs 5% (display shape only). Holders: Maya Chen (Common, 4,000,000, 40%, maya@northwind-robotics.test), Arjun Patel (Common, 3,000,000, 30%, no email), four option grants totalling 600,000 (6%), Sequoia Mock Capital (Series Seed Preferred, 1,000,000, 10%, email priya@sequoia-mock.test), Lighthouse Mock Ventures (SAFE, $500,000, no shares, email tom@lighthouse-mock.test), Lena Fischer (SAFE, $50,000, email lena.fischer@mock.test). |
| `carta-fixture` (Carta side) | Same company in Carta, plus a second context "Northwind Labs (inactive)" for `list_contexts`/`set_context`; one deliberate vesting issue (grant past cliff with no vesting event). |
| `agent-none` / `agent-exists` | No Carta agent bot, or one already created. |
| `model-none` | No model set up. |
| `gmail-connected` | 2 sent "Northwind investor update" emails (July, August 2026); 1 audit confirmation request from dortiz@kpmg-mock.test for Lighthouse Mock Ventures as of 2025-12-31 listing "SAFE $500,000"; 1 DocuSign email "Please sign: Audit confirmation – Lighthouse Mock Ventures" with no figures. |
| `finance-connected` | Cash $2.4M, monthly burn $180k. |
| `phone` | Browser width 390 x 844, touch. |

### Summary

| Type | Count |
|---|---|
| Short | 21 |
| Medium | 7 |
| Long | 5 |

### Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Find the page (sidebar, search, Integrations card) | 001, 028 | no way to hide it (by design) |
| First impression, empty and disconnected states | 001, 002, 022 | none |
| Carta connection, expiry, duplicates | 003, 004, 005, 024 | none |
| Reading Carta, Refresh, polling | 004, 024, 025, 026, 032 | no "last read failed" message when a run fails after starting |
| The table (holdings, kinds, columns) | 014, 029, 030 | none |
| Hide amounts | 021, 033 | chat replies are not fully masked (documented) |
| Phone width | 022, 023 | none |
| Carta agent panel (auto create, collapse, Ask, full screen) | 006, 007, 008, 023 | none |
| Contacts CRUD, filters, undo | 009, 010, 011, 012, 013, 029, 031 | no search on page (not built) |
| Ask about holders / SAFEs / pool | 014, 015, 016 | as-of-date holdings depend on Carta `fetch` |
| Writes switch and approval | 016, 027 | an actual Carta write is not walkable without a sandbox |
| Investor update / audit skills | 018, 019, 033 | routine suggestions not built |
| Errors | 002, 005, 011, 024, 026, 031 | none |

### Story Dependency Graph

```text
STORY-CAP-001 (find Cap table) ── STORY-CAP-028 (other routes in)
├── STORY-CAP-002/022 (empty, disconnected) ── STORY-CAP-009 (add first contact) ── 010/011/012/013/031
├── STORY-CAP-003 (connect in place) ── 004 (did it work) ── 005 (expired)
│   ├── STORY-CAP-024 (no model) ── 025 (refresh)
│   └── STORY-CAP-006 (auto agent) ── 007/008/023 (panel) ── 014/015/016 ── 018/019/033 (long)
│                       └── 027 (writes switch)
├── STORY-CAP-021 (hide amounts) ── 033
├── STORY-CAP-029/030 (table rows)
└── STORY-CAP-017 (long: first visit to working setup)
```

### Stories: Finding the page and first impression

#### STORY-CAP-001: "Where do I see who owns my company?"

**Type**: short
**Topic**: Navigation
**Persona**: Maya, just finished onboarding, has never opened Cap table.
**Goal**: Find where the product keeps ownership information.
**Preconditions**: `contacts-base`, `carta-none`, `agent-none`.
**Ideal path**: 1 — one sidebar click should land on an ownership view.
**Alternate paths**: Type "cap" in the sidebar search box (see STORY-CAP-028); typing `/app/cap-table` directly.

##### Steps
1. Scan the left sidebar for anything about ownership or equity → finds "Cap table" (pie icon) after "Finance" and before "Data room" (`Shell.tsx:3501-3510`).
2. Click "Cap table" → URL `/app/cap-table`; heading "Cap table"; header has an eye icon and an outline "Add contact" button; a card "See who owns your company"; tabs All / Investors / Auditors / Other; a table of 5 people (Name, Email; Kind on a wide window). No side panel.
3. Read the card → "Ownership comes from Carta. Connect it to see holders, the option pool and SAFEs here…" with a "Connect Carta" button. **Hesitation:** Maya does not know what Carta is or whether her company uses it; the text assumes she does. She also expects to see percentages and instead sees five names she did not type, if the account was seeded.
4. Look for share counts → none until Carta is connected. This now matches what the card says.

##### Variations
- Phone width: the sidebar is behind the menu button; see STORY-CAP-022.

##### Edge Cases
- Maya searches "Equity" → the sidebar search matches page names, so "equity" finds nothing.

#### STORY-CAP-002: Empty Cap table on day one

**Type**: short
**Topic**: Empty states
**Persona**: Maya with nothing set up.
**Goal**: Understand what to do on an empty page.
**Preconditions**: `contacts-empty`, `carta-none`, `agent-none`.
**Ideal path**: 1 — click "Connect Carta" if she uses Carta, otherwise add a contact.
**Alternate paths**: none found.

##### Steps
1. Open Cap table → brief 3-row grey skeleton, then the "See who owns your company" card, the tabs, and below them centred grey text "Add your investors, auditors and counsel here. Contacts are your address book." There is no button in the empty text on the All tab; "Add contact" is in the header.
2. Decide what to click → two buttons, "Connect Carta" (primary, in the card) and "Add contact" (outline, header). **Hesitation:** "address book" is a new idea on a page called Cap table; she does not know contacts are not the cap table.

##### Edge Cases
- Contacts load fails → red "Could not load contacts" (or the server's text) with "Try again" (`CapTable.tsx:683-690`). The card above still shows.
- The empty text never says that nothing was imported from Carta, because Carta is not connected.

### Stories: Connecting Carta

#### STORY-CAP-003: Connect Carta for the first time

**Type**: medium
**Topic**: Carta connection
**Persona**: Maya, whose company is on Carta and who has a Carta login.
**Goal**: Link Carta so the product can show her cap table.
**Preconditions**: `carta-none`, `agent-none`, `contacts-base`, Carta sandbox/stub reachable at `mcp.app.carta.com`, a model set up.
**Ideal path**: 3 — click Connect Carta, approve in Carta's window, click Done.
**Alternate paths**: Integrations → "Carta" tile → same dialog; Integrations → "Add custom connection" with `https://mcp.app.carta.com/mcp` (counts as Carta by host).

##### Steps
1. On Cap table click "Connect Carta" in the card → a dialog opens over the page (no navigation). It waits for the server list first (`CapTable.tsx:200`), so there can be a short blank moment. **Hesitation:** if nothing appears for a second she may click again.
2. The dialog shows the Carta sign-in step ("step 1 of 2") and a Carta window/popup opens → she signs in to Carta and approves.
3. Dialog changes to "Carta connected" / "The Carta agent can now read your cap table." → click "Done".
4. Back on Cap table the "See who owns your company" card disappears; the Refresh icon appears; the header "Add contact" turns primary; skeleton figure cards and "Reading Carta…" show while the first read runs (see STORY-CAP-004).

##### Variations
- Popup blocked: the sign-in step offers an open-again link and a "Try again" (`CustomConnectionDialog.tsx:785-792`). Record the exact text.
- A Carta server already exists (expired): the dialog reuses it instead of adding a second one (comment at `CapTable.tsx:199`). See STORY-CAP-005.

##### Edge Cases
- The server list fails to load → dialog never shows; a toast with the error appears (`CapTable.tsx:833-836`).
- Maya closes the dialog before approving → page re-checks servers; the card stays.

#### STORY-CAP-004: Did the connection work?

**Type**: short
**Topic**: Carta connection / Reading
**Persona**: Maya just back from Carta's sign-in.
**Goal**: Confirm Carta is linked and see her data.
**Preconditions**: `carta-connected`, `snapshot-none`, `contacts-base`, `agent-none` then auto-created, `carta-fixture` on the Carta side.
**Ideal path**: 1 — wait while the page fills in.
**Alternate paths**: Integrations → Carta card shows "Open Cap table".

##### Steps
1. Right after Done, look at the page → card gone; four grey skeleton blocks where figures will be; "Reading Carta…" text; the Refresh icon spinning and disabled.
2. Wait (typically tens of seconds to minutes) → the page polls every 3 s; figures, ownership bar and holdings fill in; "Northwind Robotics · Updated just now" appears under the heading. The Carta agent panel opens on the right with the agent's summary of what it saved (new investors added, mail threads found).
3. **Hesitation:** between steps 1 and 2 nothing says how long it takes or that the right-hand panel is the agent working. If she leaves the page she sees nothing happening.

##### Edge Cases
- `rpc.mcp.servers.list` fails on load → the page keeps assuming Carta is connected, hides the card, and never loads the cap table (STORY-CAP-026).
- The run starts but the model fails later → spinner stops; no snapshot; no error line (suspected problem 4).

#### STORY-CAP-005: Carta sign-in expired

**Type**: short
**Topic**: Errors / Carta connection
**Persona**: Maya returning after weeks away.
**Goal**: See her cap table again.
**Preconditions**: `carta-needs-auth`, `agent-exists`, `contacts-base`, `snapshot-fixture`.
**Ideal path**: 2 — read the headline, click "Reconnect Carta".
**Alternate paths**: Integrations → the Carta card.

##### Steps
1. Open Cap table → headline "Sign in to Carta again to see who owns your company"; button "Reconnect Carta". The saved snapshot is not shown (`CapTable.tsx:532`), figures are gone, the Ask button and panel are gone. **Hesitation:** her data has disappeared; she may think it was deleted.
2. Click "Reconnect Carta" → same dialog as STORY-CAP-003, reusing the existing server → sign in → Done.
3. Page re-checks servers, snapshot returns; the agent panel returns with the earlier chat.

##### Edge Cases
- Maya asks the agent a question elsewhere (bot page) before reconnecting → the agent cannot read Carta; record the exact message.

### Stories: The Carta agent panel

#### STORY-CAP-006: The Carta agent appears by itself

**Type**: short
**Topic**: Agent panel
**Persona**: Maya, first time, Carta just connected.
**Goal**: Get the assistant that answers equity questions.
**Preconditions**: `carta-connected`, `agent-none`, `contacts-base`.
**Ideal path**: 0 — no click; the panel appears. (Ideal 1 if she must open it.)
**Alternate paths**: none (`bots.create` rejects the reserved key).

##### Steps
1. Land on Cap table with Carta connected and no agent → a small spinner in the right panel ("Loading") while the agent is created (`Shell.tsx:2666`, `ensureCartaAgent`).
2. The panel shows the avatar and name "Carta agent", a "Collapse Carta agent" icon, the sentence "The Carta agent reads your cap table from Carta and answers questions about it. Try one:" and two suggestion buttons "Who are our investors?" and "Draft this month's investor update".
3. **Hesitation:** she does not know who "Carta agent" is or that it is the same thing that read her cap table.

##### Variations
- Creation fails → panel shows red text (e.g. "Could not create the Carta agent") and a "Try again" button (`Shell.tsx:2640`, `agentPanel.create`). Collapsing the panel leaves an "Ask" button so the error can be reached again (`lib/carta-agent.ts` `cartaPanelState`).
- Carta not connected → no panel at all and no Ask button; nothing says an agent exists.

##### Edge Cases
- The check runs again on window focus while the agent is missing, so connecting Carta in another window creates the agent when she returns.

#### STORY-CAP-007: Hide and bring back the agent

**Type**: short
**Topic**: Agent panel
**Persona**: Maya wanting more room for the table.
**Goal**: Collapse the side panel and get it back.
**Preconditions**: `agent-exists`, `carta-connected`, `snapshot-fixture`.
**Ideal path**: 2 — collapse, "Ask".
**Alternate paths**: none.

##### Steps
1. Click the panel's "Collapse Carta agent" icon → panel closes; an outline "Ask" button (chat bubble icon, label "Ask Carta agent") appears at the end of the header.
2. The table gets wider: Shares and Kind columns show at wider container widths.
3. Click "Ask" → panel returns with the chat history.
4. Navigate to Inbox and back to Cap table → the panel stays collapsed or open as she left it; the choice is saved for her user in the browser (`bots-sidebar-pref.ts`). **Hesitation:** a different browser starts open again.

##### Variations
- A narrow window dragged below 768 px collapses the view only; the saved preference is kept (`Shell.tsx` `useOnPhoneWidth`).

#### STORY-CAP-008: Open the agent full screen

**Type**: short
**Topic**: Agent panel / navigation
**Persona**: Maya wanting a bigger chat for a long answer.
**Goal**: Chat with the Carta agent on its own page.
**Preconditions**: `agent-exists`, `carta-connected`.
**Ideal path**: 1.
**Alternate paths**: The "Carta agent" row in the bots list in the sidebar, if shown there.

##### Steps
1. Click the agent's name and avatar at the top of the panel (the button's accessible name is "Carta agent", `Shell.tsx:4378-4384`) → app navigates to the bot's own page; Cap table is gone.
2. Look for a way back to the table → only the sidebar "Cap table" row. **Hesitation:** the name button does not look like a link.

##### Edge Cases
- Same chat thread in two places (panel and bot page); see Redundancy Candidates.

### Stories: Contacts

#### STORY-CAP-009: Add an investor by hand

**Type**: short
**Topic**: Contacts
**Persona**: Maya who just closed an angel check.
**Goal**: Record "Rita Gomez" (rita@gomez-angel.test, angel) as an investor.
**Preconditions**: `contacts-base`, `carta-none`.
**Ideal path**: 3 — open form, fill, save.
**Alternate paths**: Click the Investors tab first so the button reads "Add investor" and the kind is pre-set; or, with Carta connected, ask the agent (no approval card for a new contact, STORY-CAP-016).

##### Steps
1. Click "Add contact" → dialog "Add contact" with Name (required), Email, Organization, Kind (defaults to Investor), Notes, and the hint under Notes "Contacts are your address book. They do not change Carta."
2. Fill Name "Rita Gomez" and Email; leave Organization empty; Notes "Angel, $25k SAFE, Oct 2026".
3. Click "Save" → dialog closes, a toast "Contact saved" shows for 8 s, the list reloads and Rita appears alphabetically.
4. **Hesitation:** the amount in Notes does not reach the cap table; the new hint partly answers this, but it sits below the Notes box, after she has typed.

##### Edge Cases
- Invalid email → the browser's own `type=email` message blocks submit.
- "Save" stays disabled until Name has non-space text.
- With the Investors tab open the dialog title is "Add investor"; on Auditors "Add auditor"; on Other "Add contact" (`CapTable.tsx:178-182`).

#### STORY-CAP-010: Fix a contact's details

**Type**: short
**Topic**: Contacts
**Persona**: Maya whose investor changed firms.
**Goal**: Change Tom Okafor's organization.
**Preconditions**: `contacts-base`.
**Ideal path**: 3 — click name, edit, save.
**Alternate paths**: Ask the agent (changes need an approval card; it matches by email only, `contact-tools.ts:90-110`).

##### Steps
1. Click "Tom Okafor" (only the name is a button; the row is not) → "Edit contact".
2. Change Organization → "Save" → toast "Contact saved", table updates.

##### Edge Cases
- Change email to priya@sequoia-mock.test → red "Another contact already has this email." plus an "Open Priya Raman" button (`CapTable.tsx:360-370`).
- Clear Organization → saved empty.

#### STORY-CAP-011: Add a contact who already exists

**Type**: short
**Topic**: Contacts / error
**Persona**: Maya who forgot Priya was already listed.
**Goal**: Add "Priya R." with priya@sequoia-mock.test, kind Other.
**Preconditions**: `contacts-base`.
**Ideal path**: 2 — the form says the email exists and offers to open it.
**Alternate paths**: none.

##### Steps
1. "Add contact" → Name "Priya R.", Email priya@sequoia-mock.test, Kind "Other" → Save.
2. The dialog stays open with red "Another contact already has this email." and a button "Open Priya Raman". Nothing is overwritten.
3. Click "Open Priya Raman" → the dialog switches to Priya's "Edit contact" form. **Hesitation:** the button appears only after a failed save, not while typing the email.

##### Edge Cases
- Cancel from the error → nothing saved.
- The error button is offered only when the typed email matches a loaded contact (`CapTable.tsx:241-246`).

#### STORY-CAP-012: See only auditors

**Type**: short
**Topic**: Contacts / filter
**Persona**: Maya in audit season.
**Goal**: List auditor contacts.
**Preconditions**: `contacts-base`.
**Ideal path**: 1.
**Alternate paths**: Ask the agent "Who are my auditor contacts?".

##### Steps
1. Click tab "Auditors" → URL gets `?kind=auditor`; only Daniel Ortiz (and any auditor holder rows).
2. Click "Other" → Sam Lee. Click "All" → all rows, `?kind` removed.
3. Reload on `?kind=auditor` → the tab is still Auditors.

##### Edge Cases
- Only investors seeded, tab "Auditors" → "No auditors yet" and an "Add auditor" button (`CapTable.tsx:697-705`).
- A bad `?kind=` value falls back to All.

#### STORY-CAP-013: Delete a contact by mistake

**Type**: short
**Topic**: Contacts / destructive
**Persona**: Maya tidying the list.
**Goal**: Delete Sam Lee, then realise it was wrong.
**Preconditions**: `contacts-base`.
**Ideal path**: 3 — open, delete, Undo.
**Alternate paths**: none (the agent has no delete tool).

##### Steps
1. Click "Sam Lee" → "Edit contact" → red "Delete" at the bottom left.
2. Click "Delete" → dialog closes, the contact disappears at once with no confirmation. A toast "Deleted Sam Lee" with "Undo" shows for 8 s.
3. Click "Undo" → the contact is saved again (as a new record with the same fields) and the toast clears. **Hesitation:** she may miss the toast at the bottom of the screen; after 8 s it is gone and the only way back is to retype.

##### Edge Cases
- Undo fails (see STORY-CAP-031).

### Stories: Asking the agent about equity

#### STORY-CAP-014: "Who owns what?"

**Type**: medium
**Topic**: Ask agent — holders
**Persona**: Maya preparing for a board call.
**Goal**: See ownership by holder, and ask follow-up questions.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`, `carta-fixture`.
**Ideal path**: 1 — read the table; 2 if she asks.
**Alternate paths**: Panel suggestion "Who are our investors?"; the full-screen agent page.

##### Steps
1. Open Cap table → figures: Fully diluted shares 10,000,000; Option pool available 900,000; Latest 409A $0.42; Amount raised $1,050,000; a bar split by share class with a legend and percentages; rows Maya Chen 4,000,000 / 40%, Arjun Patel 3,000,000 / 30%, the four option grants, "Unallocated pool" 900,000 / 9%, Sequoia Mock Capital 1,000,000 / 10%, and the two SAFEs with a dollar label and "—" for shares.
2. In the panel type "Who owns my company and what percent each?" → the agent answers from `cap_table_read` first and uses Carta for anything missing.
3. Ask "Is that fully diluted?" → agent explains basis.
4. Check that no figure is invented; missing values should say TBD (`carta-agent.ts:14`).
5. **Hesitation:** the two sources can disagree if Carta changed after the last read; the agent is told to use Carta for "newer" data but the page does not say which it used.

##### Variations
- Two Carta companies → the agent should say which company it used.

##### Edge Cases
- Percentages in the table are the saved Carta figures; the Unallocated pool percent is computed by the page for display only (`CapTable.tsx:100-102`).

#### STORY-CAP-015: SAFEs and the option pool

**Type**: medium
**Topic**: Ask agent — securities, SAFEs, option pool
**Persona**: Maya planning a Series A.
**Goal**: Understand outstanding SAFEs and how much of the pool is left.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`, `carta-fixture`.
**Ideal path**: 2 questions.
**Alternate paths**: none.

##### Steps
1. Ask "What SAFEs haven't converted yet?" → Lighthouse Mock Ventures $500,000 and Lena Fischer $50,000, $10M post-money cap, dates (the page rows show only "SAFE, $500,000" and "SAFE, $50,000").
2. Ask "How many options can I still grant?" → 900,000 of 1,500,000 (card says 900,000).
3. Ask "What happens to ownership if the SAFEs convert at the cap?" → an estimate (post-money: $550k/$10M = 5.5%), labelled as one.
4. Ask "Grant 50,000 options to our new hire Jo" with writes off → agent says it cannot change Carta and tells her to do it in Carta. With writes on, see STORY-CAP-027.

##### Edge Cases
- "Anything wrong with my cap table?" → should surface the seeded vesting issue (healthcheck is no longer in the fixed tool list; the agent must find it through `discover`/`fetch`; record what it does).

#### STORY-CAP-016: Agent finds investors missing from contacts

**Type**: medium
**Topic**: Ask agent + contacts
**Persona**: Maya who wants the contact list to match Carta.
**Goal**: Add Carta investors who are not in contacts.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`, `contacts-base` minus Tom Okafor.
**Ideal path**: 2 — ask, read the confirmation. Adding new contacts needs no approval.
**Alternate paths**: Click "Add email" on the holder row (STORY-CAP-029); add by hand (STORY-CAP-009).

##### Steps
1. Look at the table first: "Lighthouse Mock Ventures" shows as a plain-text holder row (no contact), kind Investor, Email "—" or "Add email". **Hesitation:** she sees an investor but cannot tell whether it is saved as a contact.
2. Ask "Are all my Carta investors in my contacts?" → agent compares `contacts_list` with the saved cap table and says Lighthouse is missing.
3. Say "Add them" → the agent calls `contacts_add`; there is no approval card for new contacts (only `contacts_save` asks). The reply says what it saved.
4. Look at the table → contacts reload only when a read run ends (`CapTable.tsx:498-503`), not after a chat reply. **Hesitation:** the new contact may not show until she refreshes the page or runs Refresh.
5. Ask "Change Lena Fischer's organization to Lena Fischer Angels" → an approval card "Save contact “Lena Fischer”" with the fields; approve; saved.

##### Edge Cases
- The holder has no email → the agent may save without one or ask.
- Reject the card in step 5 → nothing saved.
- An email already in contacts → the tool returns "Another contact already has this email.".

### Stories: Long end-to-end stories

#### STORY-CAP-017: First visit to a working setup

**Type**: long
**Topic**: End-to-end onboarding
**Persona**: Maya, first day in the product, company on Carta.
**Goal**: Go from nothing to a populated cap table and an answered question.
**Preconditions**: `contacts-empty`, `carta-none`, `agent-none`, `model` present, Carta sandbox/stub with `carta-fixture`.
**Ideal path**: 4 — open Cap table, Connect Carta, Done, read.
**Alternate paths**: Integrations first, then Cap table.

##### Steps
1. Sidebar → "Cap table" → the "See who owns your company" card and the grey empty text.
2. Read the card; she is unsure what Carta is. She clicks "Add contact" first, then cancels. **Hesitation:** two equal-looking actions.
3. Click "Connect Carta" → dialog over the page → Carta window → sign in → approve.
4. Dialog "Carta connected" → "Done".
5. Page: card disappears; skeleton cards; "Reading Carta…"; the agent panel appears with a spinner.
6. Wait while the page polls; the Carta agent writes a summary in the panel.
7. Figures fill in, the bar appears, the table shows Maya, Arjun, option grants, the pool row, Sequoia and the two SAFEs.
8. Investor holders were added as contacts by the run (Investors tab now has them; some need "Add email").
9. Click the "Investors" tab → URL `?kind=investor`; only investor rows.
10. Click "Add email" on "Lena Fischer" if she has no contact email → "Add investor" dialog prefilled; add lena.fischer@mock.test → Save → "Contact saved".
11. In the panel click "Who are our investors?" → the agent answers.
12. Collapse the agent → wider table; click "Ask" to bring it back.
13. Click the eye icon → every figure turns to `•••`.
14. Click the eye again to restore.
15. **Friction to record:** no time estimate while reading, the silent first read when no model exists, the table not refreshing after an agent chat save.

#### STORY-CAP-018: Monthly investor update

**Type**: long
**Topic**: Skill carta-investor-update
**Persona**: Maya who owes investors the September update.
**Goal**: Get a draft in Gmail addressed to all investors.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`, `contacts-base`, `gmail-connected`, `finance-connected`.
**Ideal path**: 4 — click the suggestion, give highlights, review draft, approve.
**Alternate paths**: Composer skill selector "carta-investor-update"; plain "write my investor update".

##### Steps
1. Click the panel suggestion "Draft this month's investor update" (or type it) → agent picks the period and calls `finance_overview` / `finance_breakdown` → cash $2.4M, burn $180k, runway ~13 months.
2. Agent reads ownership from the saved cap table and recipients via `contacts_list` kind investor.
3. Agent flags any Carta investor not in contacts and adds them with `contacts_add` (no card).
4. Agent reads the July and August sent updates for tone.
5. Agent asks for highlights, lowlights, asks → Maya answers in chat.
6. Agent saves a Gmail draft to Maya with investors in Bcc; shows it; lists TBD items.
7. Maya opens Inbox/Gmail to check the draft (a draft needs approval, `mail_draft`).
8. **Hesitation:** whether it was sent — it is only a draft; the skill never sends.

##### Edge Cases
- Lena Fischer has no email in contacts → recipient missing; agent says so.
- Hide amounts on: the figures in the chat text are masked where they are written as currency; plain numbers may show.

#### STORY-CAP-019: Auditor confirmation request

**Type**: long
**Topic**: Skill carta-audit-response
**Persona**: Maya who got an audit email from Lighthouse's auditor.
**Goal**: Reply with correct holdings.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`, `contacts-base` minus Daniel Ortiz, `gmail-connected`.
**Ideal path**: 4 — ask, review comparison, approve send.
**Alternate paths**: skill selector vs "do I have any audit requests?".

##### Steps
1. Ask "Any auditor requests I need to answer?" → `mail_search` + `mail_grep` find the KPMG Mock email and the DocuSign envelope.
2. Agent extracts fund (Lighthouse Mock Ventures), as-of 2025-12-31, items (SAFE $500,000).
3. Agent adds Daniel Ortiz as an auditor with `contacts_add` (no approval card).
4. Agent compares with Carta: SAFE dated 2026-03-01 — after the as-of date — so the holding as of 2025-12-31 should be $0; reports the difference exactly.
5. DocuSign email has no figures → agent gives the Carta numbers to check and does not say "sign it".
6. Agent drafts a reply; "still needed from you" list.
7. Maya asks to send → approval card shows full to/cc/bcc/subject/body → approve → sent.
8. Check Cap table → "Auditors" tab shows Daniel Ortiz after the table reloads.

##### Edge Cases
- Agent tries to send by draft id only → refused (`executor.ts:4415`).
- Carta cannot answer as-of-date holdings → agent must say so (`docs/carta/README.md`).

#### STORY-CAP-020: Board prep in one sitting

**Type**: long
**Topic**: Cross-area
**Persona**: Maya with a board meeting tomorrow.
**Goal**: Know the cap table, pool, SAFE exposure, and who to email.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`, `contacts-base`.
**Ideal path**: 4 questions in one chat.
**Alternate paths**: Finance page agent for cash numbers.

##### Steps
1. Cap table → read the page → "Summarise my cap table for the board" in the panel → ownership table.
2. Click Refresh first if the "Updated" time is old → spinner, then new time.
3. "Anything wrong with it?" → healthcheck-style findings (agent must use Carta `fetch`; record).
4. "Option pool left?" → 900,000 (the card already says it).
5. "If we raise $3M at $15M pre, what's the dilution?" → estimate, labelled as such.
6. "Which board members are in my contacts?" → agent can only list contacts; there is no "board member" kind (Investor, Auditor, Other).
7. Collapse the panel, review the Investors tab, click "Sam Lee" to check notes "Company counsel".
8. Ask for cash and runway → the Carta agent has `finance_*` tools; compare with the Finance page agent; two agents can answer the same question.

### Stories: New since the 2026-10-16 catalog

#### STORY-CAP-021: Hide amounts on Cap table

**Type**: short
**Topic**: Hide amounts
**Persona**: Maya working in a coffee shop, a stranger can see her screen.
**Goal**: Stop the share counts and dollars showing on screen.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`.
**Ideal path**: 1 — click the eye.
**Alternate paths**: Account menu → "Hide amounts"; the same switch works on Finance.

##### Steps
1. Find the eye icon in the page header (label "Hide amounts", tooltip: "Hide amounts. Hides amounts on finance screens and masks currency amounts in chat text. Plain numbers in agent replies may still show.") → click.
2. Check the page: the four figure cards show `•••`, `$•••`; legend percentages show `•••%`; Shares and Ownership columns show `•••` / `•••%`; the SAFE holding labels read "SAFE, $•••". The icon becomes crossed-out and the label "Show amounts".
3. Look for what is still visible → holder names, emails, kinds, share class names, the update time and the **ownership bar segment widths**. **Hesitation:** the bar still shows the proportions, so a stranger can read "about 40/30/10/15" without any number.
4. Reload → the choice is kept (saved in the browser). Click the eye again → numbers return live without a reload.

##### Edge Cases
- Open the agent's reply with "$550,000" while hidden → currency text is masked, but "900,000 options" is not (helper text says so).
- Storage blocked → the choice lasts only until reload.

#### STORY-CAP-022: Cap table on a phone, Carta off

**Type**: short
**Topic**: Phone width / disconnected
**Persona**: Maya on her phone in a taxi.
**Goal**: Check the page and connect Carta.
**Preconditions**: `phone`, `contacts-base`, `carta-none`.
**Ideal path**: 3 — menu, Cap table, Connect Carta.
**Alternate paths**: none.

##### Steps
1. Open the sidebar menu → tap "Cap table".
2. The header holds the title, eye icon and "Add contact"; the card stacks (icon, text, then a full "Connect Carta" button); the tabs sit below.
3. The table shows Name with the kind and organization lines under it, and Email; the Kind column is hidden (`@lg`).
4. Tap "Connect Carta" → dialog fits the screen; Carta sign-in opens in a new tab or window.
5. **Hesitation:** on a phone the return from the Carta window may leave the dialog waiting; record whether the dialog notices the sign-in finished.

##### Edge Cases
- Touch targets: the eye and Refresh buttons use a larger tap size on coarse pointers (`pointer-coarse:size-10`).
- Long names truncate with a hover title that a phone cannot show.

#### STORY-CAP-023: Cap table on a phone, Carta on

**Type**: medium
**Topic**: Phone width / table and Ask
**Persona**: Maya at the airport before a call.
**Goal**: Read her ownership and ask a question.
**Preconditions**: `phone`, `carta-connected`, `snapshot-fixture`, `agent-exists`.
**Ideal path**: 3 — open page, read cards, tap "Ask".
**Alternate paths**: none.

##### Steps
1. Open the page → the panel is collapsed by default on a phone (`Shell.tsx:499-511`); header shows eye, Refresh, "Add contact" and "Ask" (they may wrap or crowd the title). **Hesitation:** four controls in one row.
2. Under the heading: "Northwind Robotics · Updated 2 hours ago"; the company name truncates before the time does.
3. Figure cards form two columns.
4. The table has Name (with "Investor · Series Seed Preferred" lines), Email, and Ownership; Shares and Kind are hidden. A holder with no contact shows the name in plain text.
5. Tap "Ask" → the agent panel opens; check whether it covers the page and can be closed with "Collapse Carta agent".
6. Type "Who owns what?" → answer; collapse; the page is back.

##### Edge Cases
- Rotate or widen the window past 768 px with the panel open → the panel stays; narrow again → it collapses.
- Ownership bar legend wraps onto several lines.

#### STORY-CAP-024: Connected, but the first read cannot start (no model)

**Type**: medium
**Topic**: Errors / Reading Carta
**Persona**: Maya who connected Carta before choosing a model.
**Goal**: See her cap table.
**Preconditions**: `carta-connected`, `snapshot-none`, `model-none`, `agent-exists`.
**Ideal path**: 3 — see why nothing happened, add a model, Refresh.
**Alternate paths**: none.

##### Steps
1. Finish the Carta sign-in → Done. The first read was skipped silently (`startCartaSync` returns `no_model`).
2. On the page: no skeleton, no "Reading Carta…", no cards, no snapshot; the table shows only contacts; the Refresh icon is active. **Hesitation:** nothing says Carta is connected but empty, or that a model is needed.
3. Click Refresh → red "Add a model before refreshing" with "Try again" (`router.ts:6345`, `CapTable.tsx:674-681`).
4. Add a model in Settings, return, Refresh → "Reading Carta…" and the page fills in.

##### Edge Cases
- "Try again" repeats the same call; fine once a model exists.
- Disconnected Carta then Refresh is unreachable (button hidden), but the API says "Connect Carta first".

#### STORY-CAP-025: Refresh from Carta

**Type**: short
**Topic**: Refresh
**Persona**: Maya after a new SAFE was signed in Carta.
**Goal**: Bring the page up to date.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`.
**Ideal path**: 1 — click the refresh icon.
**Alternate paths**: Ask the agent in chat to update the page (it can call `cap_table_update`).

##### Steps
1. Click the circular-arrows icon (label "Refresh from Carta", no visible text) → it spins and is disabled.
2. The page shows the old snapshot while "syncing"; the panel chat shows the agent working; the table is not replaced by skeletons (only when there is no snapshot).
3. When the run ends, "Updated just now" shows and contacts reload.
4. **Hesitation:** the icon has no text label; a first-timer may not guess it reads Carta again.

##### Edge Cases
- Click again while running → disabled; a second click cannot start a second run (server allows one at a time, `carta-agent.ts:143-148`).
- Failure → red "Could not refresh from Carta" (or server text) with "Try again".

#### STORY-CAP-026: The cap table cannot load, or the connection check fails

**Type**: short
**Topic**: Errors
**Persona**: Maya on a flaky connection.
**Goal**: Understand what failed and recover.
**Preconditions**: `carta-connected`, `snapshot-fixture`; API fails once for `carta.capTable`; second walk with `mcp.servers.list` failing.
**Ideal path**: 2 — read the error, click Try again.
**Alternate paths**: reload.

##### Steps
1. Open Cap table while `carta.capTable` fails → red "Could not load the cap table" with "Try again" above the table; polling stops while the error shows (`CapTable.tsx:505`).
2. Click "Try again" → the snapshot returns and polling resumes.
3. Second walk: make `mcp.servers.list` fail → no error is shown at all (`CapTable.tsx:494`). The "See who owns your company" card is hidden (the page assumes connected), no figures load, the Shell is told nothing so there is no Ask button and no panel. **Hesitation:** the page looks like a plain contact list with Carta apparently connected.

##### Edge Cases
- Contacts fail but the cap table loads → two separate error areas; each has its own Try again.

#### STORY-CAP-027: Turn on "Allow changes in Carta"

**Type**: medium
**Topic**: Writes switch / approval
**Persona**: Maya who wants the agent to grant 50,000 options to Jo.
**Goal**: Let the agent change Carta, safely.
**Preconditions**: `carta-connected`, `agent-exists`.
**Ideal path**: 5 — Integrations, Carta card, switch, confirm, ask, approve.
**Alternate paths**: none (Cap table has no shortcut to the switch).

##### Steps
1. Ask the agent "Grant 50,000 options to Jo" → it says it cannot change Carta (writes off).
2. Sidebar → Integrations → the Carta card (shows "Open Cap table") → open it.
3. Find the switch "Allow changes in Carta" → turn on → a confirm dialog: "The Carta agent will be able to change your Carta data. It asks before each change." → confirm.
4. Back on Cap table, ask again → the agent calls Carta's change tool; an approval card shows what it will change; she approves or rejects.
5. **Hesitation:** the switch lives two pages away from the place she is asking; and the agent's answer in step 1 does not point to it.

##### Edge Cases
- Turning the switch off needs no confirmation.
- Another bot asked to use Carta → "Carta is used only by the Carta agent.".
- A non-Carta MCP server has no such switch.

#### STORY-CAP-028: Reaching Cap table by other routes

**Type**: short
**Topic**: Navigation / sidebar
**Persona**: Maya who cannot find the sidebar row on a small screen.
**Goal**: Open the page by search and from Integrations.
**Preconditions**: `carta-connected`.
**Ideal path**: 2 — type a few letters, click the result.
**Alternate paths**: Integrations → Carta card → "Open Cap table".

##### Steps
1. Click the sidebar search ("Search chats") and type "cap" → a result "Cap table" with the pie icon appears among the page results; click → page opens and the search clears.
2. In Integrations, open the Carta card → "Open Cap table" button → lands on the page.
3. Try to hide the "Cap table" sidebar row → there is no control; the sidebar-pages "Add page" menu offers only pages that are available, and none touches Cap table (`sidebar-pages.ts`). **Hesitation:** a founder who does not use Carta cannot remove the row.

##### Edge Cases
- The search placeholder says "Search chats", so Maya may not try it for a page name.

#### STORY-CAP-029: "Add email" on a holder

**Type**: short
**Topic**: Table rows
**Persona**: Maya who wants to email Arjun's co-investor.
**Goal**: Make an investor holder a contact with an email.
**Preconditions**: `carta-connected`, `snapshot-fixture` with an investor holder who has no email in the snapshot and no contact; `contacts-base`.
**Ideal path**: 2 — click "Add email", fill, save.
**Alternate paths**: ask the agent.

##### Steps
1. Find the row (plain-text name, Email column shows a link-style "Add email"; only investor-type holders get it).
2. Click "Add email" → dialog "Add investor" prefilled with the holder's name, organization and Kind Investor.
3. Type the email → Save → toast "Contact saved"; the row now shows the email and the name becomes a clickable button (join is by email).
4. **Hesitation:** if the email she types differs from the one Carta has for the holder, the row stays plain text and a second row appears.

##### Edge Cases
- Founders and option holders (Common, Options) show "—", not "Add email".

#### STORY-CAP-030: Founders, options and investors in the table

**Type**: short
**Topic**: Table rows / filters
**Persona**: Maya who wants only her investors.
**Goal**: Read the Investors tab and know what it contains.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `contacts-base`.
**Ideal path**: 1 — click "Investors".
**Alternate paths**: none.

##### Steps
1. Click "Investors" → only investor-class rows: Sequoia Mock Capital, the two SAFE holders and investor contacts; founders and option grants are hidden. Their Kind column (wide windows) reads Investor with the security under it ("Series Seed Preferred", "SAFE, $500,000").
2. Click "Other" → Sam Lee plus any Shareholder rows (founders); "Options" rows have no tab of their own and show only on "All". **Hesitation:** "Other" holds both counsel and Arjun; Options can only be found on All.
3. On "Investors" the header button reads "Add investor".

##### Edge Cases
- A security the code does not recognise (e.g. "Common") is a Shareholder, even for an outside investor holding common.

#### STORY-CAP-031: Undo that fails

**Type**: short
**Topic**: Errors / contacts
**Persona**: Maya who deleted Sam Lee, then went offline.
**Goal**: Get Sam Lee back.
**Preconditions**: `contacts-base`; make the save call fail once.
**Ideal path**: 2 — Undo, retry.
**Alternate paths**: re-add by hand.

##### Steps
1. Delete "Sam Lee" → toast "Deleted Sam Lee · Undo".
2. Click "Undo" with the save failing → the toast changes to "Could not restore Sam Lee" (or the server text) with "Try again" and "Dismiss"; it no longer disappears by itself.
3. Click "Try again" after the network returns → restored; toast clears; list reloads.
4. **Hesitation:** "Dismiss" loses the contact for good; nothing warns.

##### Edge Cases
- Double-clicking Undo quickly does not create two contacts (guard at `CapTable.tsx:559-560`).
- Email was reused by a new contact meanwhile → the restore fails with "Another contact already has this email.".

#### STORY-CAP-032: A read started somewhere else

**Type**: short
**Topic**: Polling / multi-tab
**Persona**: Maya with Cap table open in two tabs, asking the agent to update in tab B.
**Goal**: See the update appear in tab A without reloading.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`.
**Ideal path**: 0 — it updates itself.
**Alternate paths**: none.

##### Steps
1. In tab B click Refresh; switch to tab A.
2. Tab A re-checks on focus/visibility → the spinner shows and "Updated" changes when the run ends; contacts reload then.
3. Leave tab A hidden for several minutes → the idle check runs every 30 s only while visible (`CapTable.tsx:508`); on return the focus check refreshes it.
4. **Hesitation:** while the run is going she gets no sign in tab A except the spinner.

##### Edge Cases
- Polling stops after a cap table load error and restarts only with "Try again".

#### STORY-CAP-033: Board prep with amounts hidden, shared screen

**Type**: long
**Topic**: Hide amounts / cross-area
**Persona**: Maya presenting her screen to a new advisor before the numbers are shared.
**Goal**: Walk the advisor through the structure without showing figures, then reveal them on purpose.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`, `contacts-base`, `gmail-connected`, `finance-connected`.
**Ideal path**: 3 — hide, present, show.
**Alternate paths**: none.

##### Steps
1. Open Cap table; click the eye before sharing her screen.
2. Check the page: figure cards, columns and legend are masked; names, kinds and the ownership bar still show.
3. Click the "Investors" tab and show the SAFE holders by name only.
4. Ask the agent "How much did Lighthouse put in?" → the answer's dollar amount is masked in the chat (`$•••`); a plain number such as "1,000,000 shares" may still show.
5. Ask "Draft this month's investor update" → the draft summary masks currency amounts in the chat.
6. Collapse the agent panel before sharing again, in case a later reply shows plain numbers.
7. Navigate to Finance → amounts stay hidden (same switch).
8. Return to Cap table, click the eye to show amounts → all figures return at once with no reload.
9. Walk the advisor through the Series Seed row, then end.

##### Edge Cases
- Account menu → "Show amounts" gives the same result.
- A new browser profile starts with amounts shown.

---

### Redundancy Candidates (this area)

- **Agent panel and bot page show the same thread** (STORY-CAP-008). Two places to chat; the name button is the only link.
- **Two ways to add an investor contact:** "Add contact" dialog versus the agent's `contacts_add`; with Carta on, the read run already adds investor holders, so three paths create the same record.
- **Cash and runway are answerable in two places:** the Carta agent's `finance_*` tools and the Finance page agent (STORY-CAP-020).
- **"Connect Carta" exists in Cap table and in Integrations** with the same dialog; fine, but Integrations' copy ("Cap table, equity and investors") and the Cap table card use different words.
- **Pool figure twice:** "Option pool available" card and the "Unallocated pool" row show the same 900,000.

### Suspected problems (this area)

1. **Silent first read with no model.** Connecting Carta with no model set up makes `startCartaSync` return `no_model` and nothing is shown (`carta-agent.ts:140`, `onMcpServerConnected` swallows it). The page is connected and empty with no message; only Refresh reveals "Add a model before refreshing" (STORY-CAP-024).
2. **Connection check failure is invisible.** If `rpc.mcp.servers.list` fails, `.catch(() => undefined)` leaves `cartaConnected` true: the Connect card is hidden, no snapshot loads, and the Shell never learns Carta state, so no Ask button or panel appears (`CapTable.tsx:494`, STORY-CAP-026).
3. **Hide amounts leaks proportions.** The ownership bar widths come straight from `percent` and are not masked (`CapTable.tsx:143-150`); only the numbers are (STORY-CAP-021).
4. **A run that fails after starting leaves no trace on the page.** `syncing` just turns false; there is no "last read failed" line; the failure text is only in the agent's chat (STORY-CAP-004).
5. **Expired sign-in hides saved data.** `snapshot` is nulled when Carta is not connected (`CapTable.tsx:532`), so a returning founder sees the data vanish instead of a stale table with a "Sign in again" banner (STORY-CAP-005).
6. **Agent-added contacts need a refresh to show.** The contact list reloads only when a run ends (`CapTable.tsx:498-503`); a chat-driven `contacts_add` appears after a manual reload (STORY-CAP-016).
7. **Refresh is icon-only.** Label "Refresh from Carta" exists only as `aria-label`; no visible text or tooltip text beyond the icon (`CapTable.tsx:591-601`).
8. **"Other" tab mixes counsel and founders; "Options" has no tab** (STORY-CAP-030; `rowKind`).
9. **The writes switch is two pages away** and the agent's refusal does not point to it (STORY-CAP-027).
10. **Cap table row cannot be hidden** even for users who never use Carta (STORY-CAP-028).
11. **Undo is time-limited with no other recovery;** "Dismiss" on a failed Undo drops the data (STORY-CAP-031).
12. **Search placeholder says "Search chats"** though it also finds pages such as Cap table (STORY-CAP-028).


---

## Area: Data room (STORY-DRM-nnn)

Source: `docs/ux-paths/dataroom/catalog.md`.


Generated: 2026-10-17
Repository: `the repository root` (branch `docs/ux-pass`, code read at HEAD `559a76ad`). PR #109 stories were read from `origin/feat/legal` at commit `f2b8fc1e` ("Legal: regenerate translation catalogs after the e2e fixes").
Total Stories: 44 (short 26, medium 17, long 1)
Persona for every story: Maya, a naive first-time founder of Northwind Robotics ("Northwind Robotics") who has never seen Praci, does not know its vocabulary ("Data room", "folder", "filing", "agent", "approval", "space"), and wants to keep the company's documents in order and find them again.

### Changes since the 2026-10-16 catalog

The Data room changed a lot on main since the last catalog (`git log -- apps/web/src/components/data-room apps/web/src/pages/DataRoom.tsx`, most recent: `78d97779` phone toolbar, `b302756f` folder URL authoritative, `f162d56f` folder in the URL, `a2d42924` folder rename/move/delete, `c3e1c923` consent prompt on the page, `ab20ab44` delete confirm + duplicate toast).

- **Kept, text unchanged in substance**: STORY-DRM-004 (50 MB refusal toast, 15 s).
- **Changed (same id, rewritten to match code)**:
  - 001 empty state now has a sentence ("Keep contracts, board decks and investor documents in one place.").
  - 002, 003 the finished-upload toast says "Uploaded" (no longer "Filed"), stays 10 s.
  - 005 a repeat upload now says "Already in your Data room" or "Already in <folder>" (`DropZone.tsx:25-31`).
  - 006 uploads now go into the open folder (it was a gap: uploads always went to the root).
  - 007 status words are now just "Reading" or blank; "Pending" and "Filing" no longer exist (`format.ts:16-17`).
  - 008 a failed file now has "Couldn't read this file", its reason, and a Delete button in the preview.
  - 009 the consent prompt now exists on the page ("Let Praci read your documents", Allow). It used to be a dead end.
  - 010 filing now follows the Allow button; the row shows the folder path under the name.
  - 011 the open folder lives in the URL; Back works; a parent folder shows its sub-folders as rows but not their files.
  - 012 view and sort are remembered in the browser (they were not); the Date and Type sort options hide until some item has a value.
  - 013 search box placeholder "Search names and text", an explanatory line under "No results".
  - 014 Type, Party and Source are now pick lists, not free-text boxes, so the capital-letter and partial-name traps are gone; Source is always offered.
  - 015 the chip is called "Document date"; "Clear filters" appears on an empty result.
  - 016 Move can create a folder ("New folder…"); folders can be renamed, moved and deleted from the same menu.
  - 017 the delete dialog says "This can't be undone." and a "Deleted" toast appears; the preview stays on the neighbouring item.
  - 018 (long) and 019 re-walked with the new behaviour; 019 and 020 are now typed medium because they have fewer than 15 steps.
  - 020 to 023 were gap stories. 020 (Gmail), 021 (Drive) and 023 (agent tools) are now working-feature stories that **require PR #109 (origin/feat/legal)**; on current main they are still gaps and each says so in Alternate paths. 022 (sharing) is still absent on both branches and stays a documented gap.
- **Dropped**: none. Every previous story still has a counterpart.
- **Added (STORY-DRM-024 to 044)**:
  - 024 to 029, 036, 038: URL folder behaviour (deep link, Back, bad id, rename or delete elsewhere, item link), search within a folder, grid sub-folders.
  - 027, 033: folder housekeeping and "New folder…" (027 found that top-level folders cannot be managed).
  - 030, 031: phone width and keyboard-only use.
  - 032, 034, 035, 037: no-model consent text, Hide amounts, sidebar search, Load more and list errors.
  - 039 to 044: PR #109 only (email picker problems, Drive browsing and export, Connect buttons, source links, import into the open folder, an agent adding an attachment on its own).

### What exists in the code (read before walking)

Main (`559a76ad`):

- Route `/app/data-room`, sidebar entry "Data room" (`Shell.tsx:1794`, `:3512`). The sidebar search also lists matching Data room files under their own group (`Shell.tsx:1830-1836`, `:3544`).
- Page `apps/web/src/pages/DataRoom.tsx`. Empty state: dashed box, "Drop files here", "Keep contracts, board decks and investor documents in one place.", button "Choose files" (`:347-361`). Otherwise: header with List view / Grid view toggles and "+" (aria "Add files"), consent card (when relevant), filter bar, folder tree (container at least 800 px) or a folder pill (below 800 px), list/grid/search results, "Load more", preview beside the list (page body at least 560 px) or in a dialog (narrower).
- **The open folder is the URL**: `?folder=<id>` (`DataRoom.tsx:83-111`). Choosing a folder pushes a history entry, so Back returns to the previous folder. A folder id that does not exist is removed from the URL after the folder list loads (`:122-141`). `?item=<id>` opens that item's folder and previews it (`:191-213`); a bad item id is ignored silently.
- Folder tree has no menu. Sub-folders of the open folder appear as rows (list) or tiles (grid) above the files, each with a "…" menu: Move, Rename, Delete (`ItemRows.tsx:228-290`). A folder shows only the files directly in it (`packages/db/src/data-room.ts:168-172` is an equality test), not those of its sub-folders.
- Drop anywhere in the app: overlay "Drop to add to Data room" and one toast per file: percentage, then "Uploaded" + "View", or "Already in …", or "Over the 50 MB limit" / "Unsupported file name" / "Upload failed" (`DropZone.tsx`). Files go into the folder the Data room page shows, or the root from any other page (`upload-toasts.ts:122-133`). Toasts last 10 s (done), 15 s (failed), 5 s ("Deleted"); they pause while the pointer is over them.
- Filter bar (`FilterBar.tsx`): search box (placeholder "Search names and text", aria "Search documents", debounced 300 ms, server-side, Escape clears), then "Type", "Party", "Document date", "Source" and "Sort: …" plus an ascending/descending arrow. Type, Party and Source are pick lists built from the rows on screen (Source always offers Upload, Google Drive, Gmail, Chat, Finance). A filter appears only when there is something to pick (Type, Party, Document date), or is already set.
- Status: while a background job works the row shows a spinner and the word "Reading"; failed shows "Failed" in red with the reason as a hover tooltip. Ready rows show nothing. The list re-reads working items every 3 s (`use-data-room-list.ts:34`).
- Preview (`Preview.tsx`): "Preview" header with "…" and a close X; name; image (for png/jpg/gif/webp up to 10 MB; hidden when Hide amounts is on); summary or "Reading" or "Couldn't read this file" + reason; Type, Date, Parties, Amount, Tags, Folder, Source, Size; failed files lead with a red "Delete"; every file has "Download".
- Consent card (`ConsentPrompt.tsx`): "Let Praci read your documents" + Allow, or, with no model, a grey note telling the founder to set up a model in Settings. After Allow, items that were waiting go through reading and filing again (`apps/api/src/data-room.ts:245-290`).
- Settings: "Embedding model" in the model settings overlay enables semantic search.

Requires PR #109 (origin/feat/legal, commit `f2b8fc1e`):

- `ImportSources` in the Data room header (`ImportFromEmail.tsx:274-331`, `ImportFromDrive.tsx`): in the empty state two buttons beside "Choose files" ("Import from email" or "Connect Gmail"; "Import from Google Drive" or "Connect Google Drive"); once the room has items they become icon buttons with those aria labels. A picker dialog per source; after import a 6 s notice "Imported N file(s)" / "Already in the Data room" / "Couldn't import N file(s)".
- Preview "Source" shows "From email" (link back into the Inbox message) or "From Google Drive" (link that opens Drive).
- Three agent tools for every owner-run agent: `search_data_room`, `read_data_room_item`, `add_to_data_room` (`packages/adapters/src/data-room-tools.ts`). `add_to_data_room` adds an email attachment, Drive file or artifact to the root unfiled, only after Data room consent.
- The PR's new `components/legal/ConsentPrompt.tsx` is the Legal agent's consent card ("Let the Legal agent read your documents"), not the Data room's; the Data room's own `ConsentPrompt.tsx` is unchanged by the PR.

Still absent on both branches: sharing with other members, the "Ask agent" button in the preview, the Data room agent and its side panel (the docs describe a "Create Data room agent" button; no code builds it), undo or trash, retry of a failed item, folder menus on the tree, multi-select or bulk download, mobile-specific layout beyond the narrow rules above.

### Mock demo data required (seed for "Northwind Robotics")

Every story names the subset it needs. The full seed is:

- **S0 – empty account**: a signed-in user with completed onboarding and zero Data room items or folders.
- **S1 – filed library** (items owned by the demo user, `source: "upload"`, `status: "ready"`, classified):
  - Folders: `Legal` > `Contracts`; `Finance` > `Invoices`; `Finance` > `Bank statements`; `Investors`; `HR`.
  - `Northwind - Series A term sheet v3.pdf` — docType `investor`, docDate 2026-09-28, parties ["Northwind Robotics", "MOCK Harbor Ventures"], tags ["funding", "series a"], summary "MOCK: draft Series A term sheet, $6M at $24M pre-money.", folder `Investors`.
  - `Northwind HQ lease renewal 2027.pdf` — docType `contract`, docDate 2026-10-03, parties ["Northwind Robotics", "MOCK Pier 9 Properties"], amountCents 2400000 USD, tags ["lease", "renewal"], folder `Legal / Contracts`.
  - `Invoice NW-1042 Acme Servo Supply.pdf` — docType `invoice`, docDate 2026-08-14, parties ["MOCK Acme Servo Supply", "Northwind Robotics"], amountCents 1875000 USD, tags ["hardware"], folder `Finance / Invoices`.
  - `Invoice NW-1043 Acme Servo Supply.pdf` — same party, docDate 2026-09-14, amountCents 920000 USD, folder `Finance / Invoices`.
  - `Mercury statement 2026-09.pdf` — docType `statement`, docDate 2026-09-30, parties ["Northwind Robotics"], folder `Finance / Bank statements`.
  - `Offer letter - Priya Raman (MOCK).docx` — docType `hr`, docDate 2026-07-01, folder `HR`.
  - `Board minutes Q2 2026.pdf` — docType `report`, docDate 2026-06-30, no folder.
- **S2 – in-progress and failed items**: `Delaware franchise tax notice.pdf` with `status: "extracting"`; `Scan 0007.jpg` with `status: "classifying"`; `Old cap table export.xlsx` with `status: "failed"`, error "Could not read this file"; `Customer NDA - MOCK Bolt Freight.pdf` with `status: "ready"`, error "Classification skipped" (preview shows "Couldn't classify").
- **S3 – unclassified library** (no consent recorded): five `ready` uploads with all facets null, no folders.
- **S4 – many items**: 60+ ready items so "Load more" appears (list page 50, search page 20).
- **S5 – folder ids**: the folder ids of `Legal`, `Contracts`, `Finance`, `Invoices`, `Bank statements` (the walker reads them from `rpc.dataRoom.folders`) so URLs like `/app/data-room?folder=<id>` can be built; plus one empty folder `Archive`; plus one empty folder `Old drafts` with a sub-folder `2025` (for delete tests).
- **Files on the walker's disk**: `MOCK Northwind pitch deck.pdf` (~3 MB), `MOCK Northwind SAFE - Jane Angel.pdf`, `MOCK board-video.mp4` (~60 MB), a byte-identical copy of `Northwind HQ lease renewal 2027.pdf` (a name with a slash cannot exist on disk; see the 004 edge case).
- **Model state**: M0 = no default model; M1 = default chat model set, no embedding model; M2 = default chat model plus an "Embedding model" value. Data room consent: C0 not recorded (Allow card shows), C1 recorded.
- **PR #109 only**: one connected mock Gmail account (provider `gmail`) with thread "MOCK Acme Servo Supply – invoice NW-1044" (PDF `invoice-1044.pdf`, 52 kB) and a second thread with a 4 kB logo image and a `.ics` invite; one connected Google Drive account (provider `googledrive`) with a folder `Contracts` holding `MOCK Customer MSA - Bolt Freight.pdf`, a Google Doc `Quarterly plan`, and a Google Form `Customer survey` (not exportable); an Inbox/Finance agent that can run tools.

### Summary

| Type | Count |
|------|-------|
| Short | 26 |
| Medium | 17 |
| Long | 1 |

### Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Find the Data room / empty state | 001, 002, 018, 035 | no sentence says what the room does beyond "Keep contracts, board decks…" |
| Upload (button, drop on page, drop anywhere, limits, duplicates, into a folder) | 002, 003, 004, 005, 006, 018, 043 | "Unsupported file name" cannot be triggered from a real file |
| Ingestion status (spinner, Reading, Failed) | 007, 008, 018 | no retry for a failed item |
| Consent card | 009, 010, 032, 019 | no "Not now"; consent lapses silently when the model changes |
| Automatic filing and folders | 010, 027, 033 | classifier can create near-duplicate folders |
| Browse (tree, pill, list/grid, sort, preview) | 011, 012, 024, 025, 030, 038 | tree has no menu; a parent folder never shows sub-folder files |
| Folders in the URL (deep link, Back, bad id, deleted elsewhere) | 011, 024, 025, 026, 028, 029 | bad `?item=` id is ignored with no message |
| Search and filters | 013, 014, 015, 036, 035, 037 | search inside a folder is silent about the scope |
| Move / rename / delete / download | 016, 017, 027, 033 | no undo for delete |
| Phone width, keyboard | 030, 031 | no mobile-specific preview layout beyond dialog |
| Hide amounts | 034 | none |
| Gmail attachment import (PR #109) | 020, 039, 041, 042, 043 | not on main |
| Google Drive import (PR #109) | 021, 040, 041, 042, 043 | not on main; first connected Drive account only |
| Sharing with a cofounder / investor | 022 | Not built on either branch |
| Agents over documents (PR #109) | 023, 044 | not on main; no "Ask agent" button; no Data room agent panel |

### Story Dependency Graph

```text
STORY-DRM-001 (Find the Data room, empty)
├── STORY-DRM-002 (First upload with Choose files)
│   ├── STORY-DRM-003 (Drop on another page)
│   ├── STORY-DRM-004 (File too large)
│   ├── STORY-DRM-005 (Same file twice)
│   ├── STORY-DRM-006 (Upload into the open folder)
│   └── STORY-DRM-007 (Watch it get read)
│       ├── STORY-DRM-008 (A file failed)
│       └── STORY-DRM-009 (Why is nothing tagged? consent)
│           ├── STORY-DRM-010 (Auto-filing into folders)
│           └── STORY-DRM-032 (No model: the grey note)
├── STORY-DRM-011 (Browse folders)  [S1]
│   ├── STORY-DRM-012 (List vs grid, sort, remembered)
│   ├── STORY-DRM-024 (Bookmark a folder / deep link)
│   │   ├── STORY-DRM-025 (Back button)
│   │   ├── STORY-DRM-026 (Stale or mistyped folder id)
│   │   └── STORY-DRM-028 (Folder deleted in another tab)
│   ├── STORY-DRM-029 (Open an item link / View in toast)
│   ├── STORY-DRM-038 (Grid with sub-folder tiles)
│   ├── STORY-DRM-013 (Search for the lease)
│   │   ├── STORY-DRM-036 (Search while a folder is open)
│   │   ├── STORY-DRM-035 (Find a file from the sidebar search)
│   │   └── STORY-DRM-014 (Filter invoices from one vendor)
│   │       └── STORY-DRM-015 (Document date filter)
│   ├── STORY-DRM-016 (Rename and move a file)
│   │   ├── STORY-DRM-033 (New folder… while moving)
│   │   ├── STORY-DRM-027 (Rename, move, delete folders)
│   │   └── STORY-DRM-017 (Delete a duplicate)
│   ├── STORY-DRM-034 (Hide amounts)
│   ├── STORY-DRM-037 (Many items: Load more, list error)
│   ├── STORY-DRM-030 (Phone width)
│   └── STORY-DRM-031 (Keyboard only)
├── STORY-DRM-018 (LONG: first week setting up documents)
├── STORY-DRM-019 (LONG: investor diligence request)
├── STORY-DRM-020 (LONG: month-end invoices from Gmail)      [Requires PR #109]
│   ├── STORY-DRM-039 (Email picker problems)                [Requires PR #109]
│   ├── STORY-DRM-041 (Connect Gmail / Drive first)           [Requires PR #109]
│   └── STORY-DRM-042 (Source link and repeat import notice)  [Requires PR #109]
├── STORY-DRM-021 (Bring in Google Drive)                    [Requires PR #109]
│   ├── STORY-DRM-040 (Browse Drive, Google Docs, unsupported) [Requires PR #109]
│   └── STORY-DRM-043 (Import into the open folder)           [Requires PR #109]
├── STORY-DRM-022 (Share with cofounder)  [gap on both branches]
└── STORY-DRM-023 (Agent over documents)                      [Requires PR #109]
    └── STORY-DRM-044 (An agent files an attachment by itself) [Requires PR #109]
```

### Stories: Getting started and uploading

#### STORY-DRM-001: Find where documents go

**Type**: short
**Topic**: Navigation / empty state
**Persona**: Maya, signed in for the first time, holding a folder of PDFs on her laptop.
**Goal**: Find the place in the app where company documents live.
**Preconditions**: S0 (empty account), any model state. On main.
**Ideal path**: 1 — one clearly named sidebar entry should take her there.
**Alternate paths**: Direct URL `/app/data-room`; the sidebar search (STORY-DRM-035); the "View" link in an upload toast once something is uploaded.

##### Steps
1. Scan the sidebar for "Documents" or "Files" → She sees "Data room" with a folder-open icon (`Shell.tsx:1794`). **Hesitation:** "Data room" is investor-diligence jargon; she may not connect it with "all my company files".
2. Click "Data room" → Page titled "Data room" with a dashed box: upload icon, "Drop files here", "Keep contracts, board decks and investor documents in one place.", and a "Choose files" button. No view toggles, search or filters are shown yet.
3. Read the box for an explanation → The sentence names the kinds of file but does not say the room reads and sorts them. She learns only that it accepts files. **Expectation:** "It's like a shared drive."

##### Variations
- Phone width: the sidebar is behind the menu button; tapping "Data room" closes the sidebar.
- With PR #109: two more buttons sit beside "Choose files" (see STORY-DRM-020, 021, 041).

##### Edge Cases
- The first list call fails: the page is not "empty", so the full filter bar shows with a red error line and "Retry" instead of the drop box (`DataRoom.tsx:396-403`).

#### STORY-DRM-002: Upload the first documents with "Choose files"

**Type**: short
**Topic**: Upload
**Persona**: Maya; wants to put the pitch deck and the SAFE in.
**Goal**: Get two PDFs into the Data room.
**Preconditions**: S0; walker has `MOCK Northwind pitch deck.pdf` and `MOCK Northwind SAFE - Jane Angel.pdf`. On main.
**Ideal path**: 2 — pick files, see them listed.
**Alternate paths**: Drag onto the page; drag onto any other page (STORY-DRM-003); "+" ("Add files") in the header once the room is not empty.

##### Steps
1. Click "Choose files" → The operating system file picker opens; several files can be selected (`DataRoom.tsx:53-62`).
2. Select both PDFs and confirm → One toast per file at the lower right (centred on a phone) with the file name, a percentage and a progress bar.
3. Wait → Each toast shows green "Uploaded" and a "View" link and disappears after 10 s. **Expectation:** that the file is now read and sorted; it has only been stored.
4. Look at the page → The empty box is replaced by the search box, the filters that have values, and a list with two rows. Each row has a spinner and the word "Reading" in grey until it is read.

##### Variations
- Click "View" in the toast → URL becomes `/app/data-room?item=<id>` and that item is open in the preview (STORY-DRM-029).
- The first time, the grey card or the "Allow" card appears above the list (STORY-DRM-009, 032).

##### Edge Cases
- Network drops mid-upload → the toast says "Upload failed" in red with a Dismiss X; stays 15 s; nothing retries.

#### STORY-DRM-003: Drop a file while on another page

**Type**: short
**Topic**: Upload (drop anywhere)
**Persona**: Maya reading her Inbox, who just saved a signed NDA to the desktop.
**Goal**: Store the NDA without leaving the current page.
**Preconditions**: S1; walker has a PDF on disk; current page `/app/inbox` (or a chat). On main.
**Ideal path**: 1 — drop the file.
**Alternate paths**: Data room "Choose files" / "+" (STORY-DRM-002).

##### Steps
1. Drag the PDF over the Inbox → A full-window overlay reads "Drop to add to Data room". **Hesitation:** she did not know this was possible; nothing on other pages advertises it.
2. Drop → Toast with progress, then "Uploaded" + "View". The file goes to the Data room root, because no Data room page is open (`upload-toasts.ts:122-133`).
3. Click "View" → Data room opens with the NDA open in the preview and its folder (none) selected.

##### Variations
- Drop onto the chat composer instead: the composer takes it as a chat attachment and the overlay goes away (`DropZone.tsx:57-58`). She may not realise these are two different places.
- Drop while a menu is open: open menus close, dialogs do not (`DropZone.tsx:53-56`).

##### Edge Cases
- Dragging text or a link (not a file) → no overlay (`dragHasFiles`).

#### STORY-DRM-004: Try to upload a file that is too big

**Type**: short
**Topic**: Upload limits
**Persona**: Maya, trying to keep the board meeting recording.
**Goal**: Store a 60 MB video.
**Preconditions**: S1; walker has `MOCK board-video.mp4` (~60 MB). On main.
**Ideal path**: 1 — attempt, get a clear refusal before waiting.
**Alternate paths**: none found.

##### Steps
1. Click "+" ("Add files") and choose the video → A toast immediately shows the name and, in red, "Over the 50 MB limit" with an X; it stays 15 s. Nothing is sent (`upload-toasts.ts:101`).
2. Look for a way to store it anyway → None: no compression hint, no larger-file option.

##### Edge Cases
- A file just under 50 MB that the server still counts as too big → server answers 413 and the toast says the same words.
- The server refuses a file name with a slash (400) → "Unsupported file name". A real file name cannot contain a slash, so the walker can only reach this by calling the upload endpoint directly.

#### STORY-DRM-005: Upload the same file twice

**Type**: short
**Topic**: Upload duplicates
**Persona**: Maya, unsure whether the lease was already uploaded.
**Goal**: Make sure the lease is in the Data room without creating a copy.
**Preconditions**: S1; walker has a byte-identical copy of `Northwind HQ lease renewal 2027.pdf` (named `lease copy.pdf`). On main.
**Ideal path**: 1 — upload and be told it already exists, and where.
**Alternate paths**: Search "lease" first (STORY-DRM-013).

##### Steps
1. Drop `lease copy.pdf` on the Data room → Toast progress, then the line "Already in Legal / Contracts as Northwind HQ lease renewal 2027.pdf" with a "View" link (`DropZone.tsx:25-31`, `upload-toasts.ts:106-123`).
2. Look at the list → No second row appears.
3. Click "View" → The original opens in the preview. **Expectation met:** she knows where it is.

##### Variations
- Same file when the original has no folder → "Already in your Data room as <original name>".
- Same name as the original → the "as …" part is left out.

##### Edge Cases
- The original was stuck or failed → the duplicate upload restarts its processing (`apps/api/src/data-room.ts`, `requeueStuck`), invisible to her except that a Failed row may become "Reading".

#### STORY-DRM-006: Upload into the folder she is looking at

**Type**: short
**Topic**: Upload + folders
**Persona**: Maya has the `Investors` folder open and drops the SAFE into it.
**Goal**: Add the SAFE directly to `Investors`.
**Preconditions**: S1; consent C0 or C1 (both variants); walker has `MOCK Northwind SAFE - Jane Angel.pdf`. On main.
**Ideal path**: 1 — drop while the folder is selected.
**Alternate paths**: Upload to the root then Move (STORY-DRM-016).

##### Steps
1. Click `Investors` in the folder tree → URL gains `?folder=<id>`; the list shows only the term sheet.
2. Drag the SAFE onto the list → Overlay "Drop to add to Data room"; toast "Uploaded".
3. Look at the list → The SAFE appears in `Investors` with a spinner and "Reading". The upload used the open folder (`DataRoom.tsx:144-147`, `upload-toasts.ts:122-133`).
4. Click "All items" → The SAFE is listed with its folder path, `Investors`, under its name.

##### Variations
- Choose files with "+" while a folder is open: same result.
- The same drop from the Inbox page goes to the root, not to this folder.
- A search is active while the folder is open: the file still goes to the folder.

##### Edge Cases
- The folder was deleted in another tab after she opened it: the upload is refused with 404 and the toast says "Upload failed", with no mention of the folder (`apps/api/src/data-room.ts:396-402`; see Suspected problems).
- Without consent the SAFE stays in `Investors` as she put it; auto-filing only moves items that have no folder.

### Stories: Processing and consent

#### STORY-DRM-007: Watch a new document get read

**Type**: medium
**Topic**: Ingestion status
**Persona**: Maya just uploaded the pitch deck and wants to know whether the app "understood" it.
**Goal**: See the document go from uploaded to read and tagged.
**Preconditions**: S1; model M1 or M2; consent C1; walker has `MOCK Northwind pitch deck.pdf`. On main.
**Ideal path**: 2 — upload, then see one clear status until done.
**Alternate paths**: none found.

##### Steps
1. Upload the deck (any route) → A new row at the top (sort "Recently added") with a spinner and the word "Reading" in grey text. A column "Status" shows when no row has types or dates yet; otherwise the word sits in the Type column.
2. Wait a few seconds → The list re-reads the item every 3 s. When it is ready the spinner turns into a file icon and the word disappears. **Misread risk:** nothing says "Done"; a ready row just has no status.
3. Click the row → The preview shows "Reading" while it works, then a summary, Type, Date, Parties, Tags and Folder.
4. Look at the folder tree → With consent a folder the classifier proposed may be new. She did not create it.
5. Look at the row in "All items" → The folder path appears as a small grey line under the name.

##### Variations
- M2 (embedding model set) vs M1: the same visible flow; only search quality differs.
- The row's sort position can change when it is read (a sort by Date or Type): the list reloads its first page instead of moving the row (`use-data-room-list.ts:196-204`).

##### Edge Cases
- She leaves the page during "Reading": work continues; no notification when it ends.

#### STORY-DRM-008: A document failed to read

**Type**: short
**Topic**: Ingestion status / errors
**Persona**: Maya scanning the list who sees a red row.
**Goal**: Understand what went wrong and fix it.
**Preconditions**: S1 + S2. On main.
**Ideal path**: 2 — see the reason, click retry.
**Alternate paths**: Re-upload the identical file, which restarts a failed item (STORY-DRM-005 edge case); undocumented.

##### Steps
1. Spot `Old cap table export.xlsx` → A red file icon (aria "Failed") and a red "Failed" in the Type or Status cell; the reason is only a hover tooltip.
2. Click the row → Preview shows "Couldn't read this file" in red with the reason ("Could not read this file").
3. Look for "Try again" → None. The preview shows a red **Delete** button and an outline **Download**. The "…" menu has Move, Rename, Delete.
4. Decide to download the spreadsheet and keep it elsewhere, or delete it and upload again.

##### Variations
- `Customer NDA - MOCK Bolt Freight.pdf` (ready with an error) → the preview shows a small grey "Couldn't classify" line; no reason, no action.
- Grid view: the failed tile keeps the same height as the others (one reserved line).

##### Edge Cases
- Clicking Delete: confirm dialog "Delete Old cap table export.xlsx?" (STORY-DRM-017).

#### STORY-DRM-009: "Why didn't it tag anything?" (the Allow card)

**Type**: medium
**Topic**: Consent card
**Persona**: Maya uploaded five documents yesterday and expected them sorted into folders.
**Goal**: Get the app to read and organise the documents.
**Preconditions**: S3 (five ready, unclassified items, no folders); model M1; consent C0. On main.
**Ideal path**: 2 — read the card, click Allow, watch items get filed.
**Alternate paths**: Settings "AI data sharing" switches look relevant but are separate; the Data room has its own card.

##### Steps
1. Open Data room → Above the search box a card headed "Let Praci read your documents": "To tag new files and sort them into folders for you, their text (and images) is sent to <model provider names>. Until then you can search by name and text and move files into folders yourself." Button "Allow". **Hesitation:** "sent to" a company name; she wonders whether the documents are shared or kept. No "Not now" button.
2. Click "Allow" → The card disappears and the list reloads (`ConsentPrompt.tsx:41-45`).
3. Watch the rows → Items the server had skipped go back through reading (`apps/api/src/data-room.ts:276-290`); the spinner and "Reading" return, then Type, Date and Parties fill in.
4. Open the folder tree → New folders the classifier created appear (STORY-DRM-010).

##### Variations
- If the card cannot load its status (network), it stays hidden silently.
- Allow fails (for example the provider list changed) → red error text in the card (`AiDataSharing.tsx` `ConsentCard`); she can press Allow again after reloading.

##### Edge Cases
- After consent, changing the default or embedding model changes the consent key, so the card returns for new uploads. Nothing explains why.

#### STORY-DRM-010: Let the app sort documents into folders

**Type**: medium
**Topic**: Automatic filing
**Persona**: Maya expects "drop it in, it goes to the right folder".
**Goal**: Upload an invoice and find it in a sensible folder without choosing one.
**Preconditions**: S1; model M1; consent C1; walker has a mock invoice PDF from "MOCK Acme Servo Supply". On main.
**Ideal path**: 1 — drop the file; it appears in the right folder.
**Alternate paths**: Manual Move (STORY-DRM-016).

##### Steps
1. Drop the invoice anywhere → Toast "Uploaded". It goes to the root if she is not on the Data room page.
2. Open the Data room, "All items" → The row shows a spinner and "Reading".
3. When read → The row shows no folder yet or, shortly after, a grey `Finance / Invoices` under the name. The tree is unchanged if the folder existed.
4. Click `Finance` then `Invoices` → The invoice is with the other Acme invoices.

##### Variations
- The classifier proposes a new path such as `Finance / Vendor bills` → a new folder appears next to `Invoices`. She can rename, move or delete it through its "…" menu when she opens its parent (STORY-DRM-027), but cannot merge it.

##### Edge Cases
- She moved the item before it finished → auto-filing only applies to items with no folder (`packages/db/src/data-room.ts:776`), so her choice stays.
- She dropped it while `Investors` was open → it lands in `Investors`, and the classifier does not move it.

### Stories: Browsing and finding

#### STORY-DRM-011: Browse folders to find the bank statement

**Type**: short
**Topic**: Folder tree / picker / URL
**Persona**: Maya, asked by her accountant for September's bank statement.
**Goal**: Find it by browsing.
**Preconditions**: S1; desktop width at least 800 px for the tree. On main.
**Ideal path**: 2 — click folder, click file.
**Alternate paths**: Search "statement" (STORY-DRM-013); folder pill on a narrower window (STORY-DRM-030).

##### Steps
1. Open Data room → The list shows everything, newest first; no preview is open until she clicks a file (`DataRoom.tsx:167-170`). The tree on the left shows "All items", then `Finance`, `Bank statements`, `Invoices`, `HR`, `Investors`, `Legal`, `Contracts` (indented).
2. Click `Finance` → URL becomes `?folder=<id>`. The list shows the sub-folder rows `Bank statements` and `Invoices` above any files directly in `Finance` (none). **Misread risk:** she expects to see all the files below `Finance`; only the folders show, and the files are one more click away.
3. Click the `Bank statements` row (or tree entry) → `Mercury statement 2026-09.pdf` listed.
4. Click the row → The preview opens on the right with Folder `Finance / Bank statements`; click "Download" → the browser saves the PDF; it is never opened in the page.

##### Variations
- Narrower than 800 px: no tree; a pill with a folder icon and the current folder's name opens a radio menu of full paths such as "Finance / Bank statements".
- Folders cannot be collapsed; every level is always shown.

##### Edge Cases
- Open folder holds nothing → text "This folder is empty. Drop files here to add them." (`DataRoom.tsx:411-417`).

#### STORY-DRM-012: Switch to grid and change the sort

**Type**: short
**Topic**: Views and sort
**Persona**: Maya, who thinks visually and wants the newest-dated contracts first.
**Goal**: See documents as tiles ordered by document date.
**Preconditions**: S1. On main.
**Ideal path**: 2 — choose grid, choose date sort.
**Alternate paths**: none found.

##### Steps
1. Click the grid icon (aria "Grid view") → Tiles with the name, and a type or status line. File tiles and folder tiles have the same height.
2. Open "Sort: Recently added" → Options Date, Name, Type, Recently added. Date and Type are listed only when at least one item has a date or type. **Misread risk:** "Date" is the date written in the document, not the upload date; items without one come last in both directions.
3. Choose "Date", then press the arrow button (aria "Descending" / "Ascending") → The order flips. Name and Type start A to Z, Date and Recently added newest first.
4. Reload the page → Grid view and the chosen sort are still there (`lib/data-room.ts:21-43`, `DataRoom.tsx:114`). **Surprise (good):** the choice is remembered in this browser only.

##### Edge Cases
- Browser storage blocked (private window) → the choice lasts only until the page closes; no message.

#### STORY-DRM-013: Search for the lease

**Type**: short
**Topic**: Search
**Persona**: Maya on a call with the landlord who needs the renewal terms now.
**Goal**: Find the lease by typing.
**Preconditions**: S1; M1 (keyword) or M2 + consent (semantic). On main.
**Ideal path**: 1 — type "lease", see it.
**Alternate paths**: Browse `Legal / Contracts`; Party filter; sidebar search (STORY-DRM-035).

##### Steps
1. Type "lease" in the box "Search names and text" → After about 300 ms the list becomes results; each result shows the name, "Legal / Contracts · Upload" and a text snippet with the matched words highlighted. The grid/list toggle no longer changes anything.
2. Look at the sort pill → It reads "Sort: Relevance" with options Relevance and Date; no direction arrow for Relevance.
3. Try a question: "when does our office lease end" → Keyword search may find nothing; the grey help line reads "Search matches words in names and text. Try fewer words." (a longer phrase) or just the first sentence (a single word). With M2 and consent the semantic search can still find it. Nothing tells her which mode is active.
4. Press Escape or the X inside the box → The box clears at once and the list returns with the earlier sort.

##### Edge Cases
- No match → "No results" plus the help line; if a filter is set a "Clear filters" button also shows.

#### STORY-DRM-014: Show all invoices from one vendor

**Type**: medium
**Topic**: Facet filters
**Persona**: Maya reconciling hardware spend with MOCK Acme Servo Supply.
**Goal**: List every Acme invoice.
**Preconditions**: S1 (two Acme invoices, classified). On main.
**Ideal path**: 2 — pick type "invoice", pick vendor.
**Alternate paths**: Folder `Finance / Invoices`; search "Acme".

##### Steps
1. Look at the filter row → Pills "Type", "Party", "Document date", and "Source" (each with a down chevron) plus "Sort: Recently added". Type, Party and the date pill show only because some rows have those values.
2. Click "Type" → A menu of the types on screen (lowercase words such as `invoice`, `contract`, `statement`). **Hesitation:** the words look like database values, and the list only contains what is loaded, so on a long library a type that sits on a later page is not offered (see Suspected problems).
3. Pick `invoice` → The pill reads "Type: invoice" with an X ("Remove filter Type"); the list narrows to the invoices.
4. Click "Party" → A menu of every full party name on screen, for example "MOCK Acme Servo Supply". Pick it → two Acme invoices remain.
5. Click the X on a pill to remove it, or open the folder `Finance / Invoices` to see the same result by browsing.

##### Variations
- "Source" menu lists Upload, Google Drive, Gmail, Chat, Finance. On main, only Upload has items: choosing Gmail gives "No results" and a "Clear filters" button. With PR #109 Gmail and Drive items exist (STORY-DRM-020, 021).

##### Edge Cases
- Setting a filter while a folder is open keeps the folder; "Clear filters" clears everything except the folder.

#### STORY-DRM-015: Contracts from last quarter

**Type**: medium
**Topic**: Date filter
**Persona**: Maya preparing a quarterly update.
**Goal**: See contracts dated July to September 2026.
**Preconditions**: S1 + S3 (some items with no document date). On main.
**Ideal path**: 3 — pick type, set the date range, done.
**Alternate paths**: Sort by Date and scan.

##### Steps
1. Click "Document date" → A popover with two date boxes (From, To) and "Apply".
2. Set 2026-07-01 to 2026-09-30, Apply → The pill reads "Jul 1, 2026 – Sep 30, 2026" with an X.
3. Open "Type" and pick `contract` → Only contracts with a document date in range.
4. Notice an unclassified contract is missing → items with no document date are excluded. The pill name "Document date" now says what the date is, so she may read it correctly.
5. Clear the range with the X on the pill.

##### Edge Cases
- Only "From" set → the pill reads "Oct 1, 2026 – …".
- The "Document date" pill is hidden entirely when no loaded row has a date and none is set.

### Stories: Editing and housekeeping

#### STORY-DRM-016: Rename a scan and move it to the right folder

**Type**: medium
**Topic**: Rename / Move
**Persona**: Maya cleaning up `Scan 0007.jpg`, which is the Delaware incorporation certificate.
**Goal**: Give it a real name and put it under `Legal`.
**Preconditions**: S1 + S2 (scan is `ready`). On main.
**Ideal path**: 3 — rename, move, confirm.
**Alternate paths**: The "…" on the row, in the preview header, or on a grid tile; all open the same dialogs.

##### Steps
1. Hover the row and click "…" (aria "More actions for Scan 0007.jpg") → menu Move, Rename, Delete.
2. Choose Rename → Dialog "Rename Scan 0007.jpg" with the name field selected; type `Delaware certificate of incorporation (MOCK).jpg`; Save.
3. Try a name with a slash, `Legal/Delaware cert` → red text "Enter a name without slashes". **Hesitation:** she tried to rename and move in one go.
4. "…" then Move → Dialog "Move <name> to" with a select: "No folder", then paths such as "Legal / Contracts", then "New folder…". Choose "Legal"; Save.
5. The preview updates: Folder "Legal"; in "All items" the row shows `Legal` under its name.

##### Variations
- Founder wants a new folder `Legal / Corporate` → Move, "New folder…", type `Corporate` (this creates a top-level folder; see STORY-DRM-033 for what that means).
- Rename dropping the extension is allowed; the download keeps the new name.

##### Edge Cases
- The item preview is open while she renames it from the list "…" → the preview updates its title (`DataRoom.tsx:499-501`).

#### STORY-DRM-017: Delete a duplicate document

**Type**: short
**Topic**: Delete
**Persona**: Maya sees two versions of the term sheet.
**Goal**: Remove the old one.
**Preconditions**: S1 plus an extra `Northwind - Series A term sheet v2.pdf` in `Investors`; the v3 preview is open. On main.
**Ideal path**: 2 — delete, confirm.
**Alternate paths**: Row "…", preview "…", grid tile "…".

##### Steps
1. "…" on the v2 row → Delete → Alert "Delete Northwind - Series A term sheet v2.pdf?" with "This can't be undone." and Cancel / Delete.
2. Press Delete → The dialog closes, the list reloads without the row, and a toast "Deleted" with the file name shows for 5 s.
3. Look for an undo or trash → None; the file and its text index are gone.

##### Variations
- Deleting the item shown in the preview on a wide page → the preview moves to the next row (or the one above) instead of closing; on a narrow page it closes (`DataRoom.tsx:492-497`).
- Delete from the failed file's red button in the preview.

##### Edge Cases
- Delete fails (offline) → red error text stays in the dialog and the button works again.

### Stories: Long end-to-end stories

#### STORY-DRM-018: First week: set up the company's document library

**Type**: long
**Topic**: Onboarding to the Data room, end to end
**Persona**: Maya, first session, with ~10 PDFs (incorporation docs, a SAFE, invoices, an offer letter) and a 60 MB video in a desktop folder.
**Goal**: Have every company document in one searchable place, sorted into folders.
**Preconditions**: S0; model M1; consent C0 (realistic first run); walker files listed above. On main.
**Ideal path**: 5 — open the room, click Allow, drop all files, see them sorted, search once.
**Alternate paths**: Upload through "Choose files", "+", page drop, drop anywhere.

##### Steps
1. Sign in; look for "Documents" in the sidebar → Finds "Data room" after scanning (STORY-DRM-001 hesitation).
2. Click it → The dashed box "Drop files here" and "Choose files". No card yet; the consent card shows only once the room is not empty.
3. Select all ten PDFs plus the video in Finder and drag them onto the box → Overlay "Drop to add to Data room"; drop.
4. Toasts stack at the lower right: ten progress bars and one red "Over the 50 MB limit" for the video.
5. Toasts turn to "Uploaded" and disappear after 10 s → She believes everything is filed in folders. **Misread risk.**
6. The list shows ten rows, each with a spinner and "Reading", then plain rows with no Type or Date (no consent, so nothing was classified).
7. Above the list a card "Let Praci read your documents" with an Allow button explains the documents will be sent to a model provider. **Hesitation:** privacy of incorporation documents.
8. She clicks Allow → The card disappears; rows go back to "Reading".
9. After a minute, Type, Date and Parties fill in. In the tree, folders such as `Legal`, `Investors`, `Finance / Invoices` and `HR` appear that she did not create.
10. She clicks a row → The preview shows a summary, Tags, and the Folder.
11. She tries search "SAFE" → The SAFE is found with a highlighted snippet.
12. She finds `Scan 0007.jpg` in the wrong place → "…" Move, picks `Legal`.
13. She wants a new folder `Corporate docs` → In the Move dialog she chooses "New folder…" (STORY-DRM-033).
14. She switches to grid view and reloads the page next day → The grid view is remembered.
15. She bookmarks `Finance / Invoices` in the browser (STORY-DRM-024).
16. Outcome: all ten documents are stored, read, sorted and findable; the video was refused with no alternative.

##### Edge Cases
- One PDF is a scan with no text: with a vision-capable model and consent it is read; otherwise it is stored and cannot be found by its words.
- No model at all (M0): step 7 shows a grey note instead of a button (STORY-DRM-032) and nothing gets sorted.

#### STORY-DRM-019: Answer an investor's diligence request

**Type**: medium
**Topic**: Search, filters, download, sharing expectation
**Persona**: Maya in Series A diligence; MOCK Harbor Ventures asked for "all customer contracts, the cap table, last three bank statements, and board minutes".
**Goal**: Collect and send those documents.
**Preconditions**: S1 + S2 + three monthly statements (July to September) in `Finance / Bank statements`; model M2; consent C1. On main.
**Ideal path**: 6 — four searches or filters, select all, share one link.
**Alternate paths**: Folder browsing for each item; Type filter.

##### Steps
1. Open Data room → The list is shown, no preview open.
2. Open "Type" and pick `contract` → Contracts listed; she must download each from its preview ("Download"); no multi-select or bulk download.
3. Remove the pill; search "cap table" → `Old cap table export.xlsx` shows Failed. The preview has Delete and Download only. She downloads it anyway.
4. Clear the search; click the folder `Finance`, then the sub-folder row `Bank statements` → three statements. Sort "Date", descending; download each.
5. Search "board minutes" → `Board minutes Q2 2026.pdf` (no folder) found; download.
6. Look for "Share" or "Invite investor" → nothing (STORY-DRM-022). The words "Data room" set the expectation of an investor-facing room; the code is owner-only.
7. Attach the downloaded files to a message in the Inbox compose box (separate feature, limits there) and likely meet its size limit with statements plus contracts.
8. Outcome: completed outside the Data room, with many repeated downloads.

##### Edge Cases
- The investor asks for "everything from Harbor Ventures" → Party menu offers "MOCK Harbor Ventures" (full name); she picks it and gets the term sheet; others without a party name are missed.

### Stories: Importing from Gmail and Google Drive, and sharing (Requires PR #109 unless noted)

#### STORY-DRM-020: Monthly close: get vendor invoices out of Gmail into the Data room

**Type**: medium
**Topic**: Email attachment import + filters
**Persona**: Maya doing month-end bookkeeping; invoices arrive as Gmail attachments.
**Goal**: Have this month's invoices in `Finance / Invoices` next to last month's.
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** S1; mock Gmail connected with thread "MOCK Acme Servo Supply – invoice NW-1044" (PDF attachment `invoice-1044.pdf`); M1; consent C1.
**Ideal path**: 3 — "Import from email", tick the attachment, Import.
**Alternate paths**: On current main (without the PR) there is no import button: download the attachment from the Inbox message and drop it on the app (the only route; Source "Gmail" never matches anything). Upload then Move. Tell an agent to add it (STORY-DRM-044).

##### Steps
1. Open Data room → In the header, beside the view toggles, two icon buttons: an envelope (aria "Import from email") and a hard-disk (aria "Import from Google Drive"), then "+". There is no visible text; she hovers and gets no tooltip. **Hesitation:** she does not know what the envelope does.
2. Click the envelope → A dialog "Import from email" with a search box "Search mail" and a list of mail that has attachments (subject bold, sender below).
3. Type "Acme" → After 300 ms the list narrows to the Acme thread.
4. Click the thread row → It expands and shows one line per attachment: a checkbox named `invoice-1044.pdf` and its size (for example "52 kB").
5. Tick the checkbox → The "Import" button becomes enabled (it is disabled while nothing is ticked).
6. Click "Import" → The dialog closes and a notice at the lower right reads "Imported 1 file" for 6 s; the list reloads.
7. The new row has a spinner and "Reading"; the preview shows Source "From email" as a link.
8. After reading, in "All items" it shows a folder path if the classifier filed it (consent C1), else no folder. She opens `Finance / Invoices` → three Acme invoices (or moves it there).
9. She opens "Document date" and picks 2026-10-01 to 2026-10-31 and Type `invoice` → only the new one.
10. Click "From email" in the preview → Opens the Inbox message the attachment came from (`/app/inbox?mail=<id>`).
11. She imports the same attachment again → Notice "Already in the Data room"; no new row.
12. Outcome: one attachment is in her library in a few clicks, without downloading it.

##### Variations
- Empty room (S0): the two import buttons are full-size next to "Choose files", labelled "Import from email" and "Import from Google Drive".
- Without Gmail connected: the envelope button reads "Connect Gmail" and goes to the integration page (STORY-DRM-041).

##### Edge Cases
- Import with the Source filter: after importing, "Source" lets her pick "Gmail" and see only imported mail files.
- On main without the PR: "Source: Gmail" returns "No results" and "Clear filters".

#### STORY-DRM-021: Bring in files from Google Drive

**Type**: medium
**Topic**: Google Drive import
**Persona**: Maya whose legal documents already live in Google Drive.
**Goal**: Copy the customer contract and the quarterly plan from Drive into the Data room.
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** S1; Google Drive connected; Drive has a folder `Contracts` with `MOCK Customer MSA - Bolt Freight.pdf` and a Google Doc `Quarterly plan`.
**Ideal path**: 3 — open the picker, tick two files, Import.
**Alternate paths**: On main without the PR there is no Drive import: download from Drive and upload by hand (STORY-DRM-002). Agents can read Drive with `drive_search`/`drive_read` but results never enter the Data room unless the agent calls `add_to_data_room` (STORY-DRM-044, also needs the PR).

##### Steps
1. Click the hard-disk button (aria "Import from Google Drive") → Dialog "Import from Google Drive" with a "Search Drive" box and the top level of My Drive: folders (with a folder icon) and files (with checkboxes).
2. Click the folder `Contracts` → The list shows that folder's files and a back arrow (aria "Back") appears beside the search box.
3. Tick `MOCK Customer MSA - Bolt Freight.pdf` → "Import" becomes enabled.
4. Click back, tick the Google Doc `Quarterly plan` → Google Docs, Sheets, Slides and Drawings can be ticked (Drive converts them to PDF).
5. Click "Import" → Dialog closes, notice "Imported 2 files", list reloads, two rows "Reading".
6. Open one row → Source shows "From Google Drive" as a link that opens the file in Drive in a new tab.
7. Outcome: both documents are copied (not synced). If she edits the Drive copy later, the Data room copy does not change.

##### Variations
- Type in the search box → searches all of Drive (the back arrow hides while a search is active).

##### Edge Cases
- Repeat import of the same Drive file → notice "Already in the Data room".

#### STORY-DRM-022: Share the Data room with a cofounder

**Type**: short
**Topic**: Sharing (gap on both branches)
**Persona**: Maya whose cofounder "MOCK Sam Okafor" joined the space and needs the same documents.
**Goal**: Let the cofounder see the documents.
**Preconditions**: S1; a second member in the same space. Checked: no share control or share API exists on main or on `origin/feat/legal` (`f2b8fc1e`).
**Ideal path**: 2 — share a folder, pick a member.
**Alternate paths**: none found.

##### Steps
1. Look for "Share" in the preview, in the "…" menu (Move, Rename, Delete), the sub-folder menus and the filter bar → none.
2. The cofounder signs in and opens the Data room → sees their own, empty Data room; items are visible only to the person who added them.
3. Outcome: Maya downloads each file and sends it.

##### Edge Cases
- With PR #109 a Gmail-imported file has a "From email" link that opens the Inbox message; that message is Maya's own mail, so Sam cannot follow it.

#### STORY-DRM-023: Ask a chat agent about a contract

**Type**: medium
**Topic**: Agent tools over documents
**Persona**: Maya wants a quick answer: "What's the notice period in our office lease?"
**Goal**: Get the answer from the stored lease without reading it herself.
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** S1; M2; consent C1; a chat agent in her own space, run by her (not a group chat, not a messaging-channel run).
**Ideal path**: 1 — ask the agent in plain words.
**Alternate paths**: On main without the PR the agent has no Data room tools: it says it cannot see the document, and Maya attaches the PDF in the chat (a separate copy). Data room search with a question (STORY-DRM-013). Download and read.

##### Steps
1. Open the lease preview and look for "Ask" or "Chat about this" → none (the planned "Ask agent" button is not built on either branch).
2. Open a chat with an agent and type "What's the notice period in our office lease?" → The agent calls `search_data_room` with the query (up to 20 results, name, type, date, snippet), then `read_data_room_item` for the lease (summary, parties, tags and up to 100,000 characters of text).
3. The agent answers from the lease text and names the file. **Hesitation:** Maya never saw the agent "open" her Data room; no approval was asked because both tools are read-only.
4. She checks the Data room → nothing changed.

##### Variations
- Consent C0: `search_data_room` still works over what is stored, but `add_to_data_room` answers that the Data room is off (STORY-DRM-044).
- Items imported through a mail or Drive connection that Maya denied to that agent are hidden from the agent's search and read.

##### Edge Cases
- A long lease → the answer notes the text was truncated at 100,000 characters.
- A file still "Reading" → the tool says no text has been extracted yet.

### Stories: Folders in the URL

#### STORY-DRM-024: Bookmark a folder and open it again

**Type**: short
**Topic**: Folder in the URL (deep link)
**Persona**: Maya, who sends her accountant a link to the invoices.
**Goal**: Open `Finance / Invoices` straight from a link.
**Preconditions**: S1 + S5. On main.
**Ideal path**: 1 — paste the link.
**Alternate paths**: Click through the tree.

##### Steps
1. Click `Finance`, then `Invoices` in the tree → The address bar shows `/app/data-room?folder=<id>`.
2. Copy the URL, open it in a new tab (already signed in) → The Data room opens with `Invoices` highlighted in the tree and only the two Acme invoices listed. No preview is open.
3. Reload the tab → Same folder.
4. Press the browser Back button → The previous folder or "All items".

##### Variations
- On a phone width the folder pill shows `Invoices`; its title attribute holds the full path.
- A signed-out person opening the link is sent to sign in first; after sign-in the folder id is kept only if the app returns to the same URL (not verified).

##### Edge Cases
- The link is opened by another member: they see their own library; the folder id does not belong to them, so it is removed from the URL (STORY-DRM-026).

#### STORY-DRM-025: Back button through folders

**Type**: short
**Topic**: Folder in the URL (history)
**Persona**: Maya who clicks folders like web pages and presses Back.
**Goal**: Return to the folder she was in before.
**Preconditions**: S1 + S5. On main.
**Ideal path**: 1 — Back.
**Alternate paths**: Click "All items".

##### Steps
1. Click `Legal`, then `Contracts` → Each click is a history entry.
2. Press Back → `Legal` is shown; the tree highlight and the list follow the URL.
3. Press Back again → "All items".
4. Press Forward → `Legal` again.

##### Variations
- A folder opened by a sub-folder row works the same.
- Filters (Type, Party, Source, Document date) and the search text are not in the URL: Back does not undo them (`DataRoom.tsx:83-85`).

##### Edge Cases
- Opening a file through a toast's "View" replaces the folder entry instead of adding one (`setFilters(..., true)`), so Back skips that step.

#### STORY-DRM-026: A stale or mistyped folder id

**Type**: short
**Topic**: Folder in the URL (bad id)
**Persona**: Maya who clicks an old bookmark to a folder that no longer exists.
**Goal**: See her documents anyway.
**Preconditions**: S1; URL `/app/data-room?folder=deadbeef`. On main.
**Ideal path**: 1 — page opens on "All items".
**Alternate paths**: none found.

##### Steps
1. Open the URL → For a moment the list may read "This folder is empty. Drop files here to add them." (the list asks for a folder that does not exist).
2. The folder list loads → The `folder` parameter is removed from the URL without a new history entry; "All items" is selected and the full list loads (`DataRoom.tsx:122-141`).
3. Nothing says the bookmark was out of date. **Hesitation:** she wonders whether the folder was deleted.

##### Edge Cases
- If the folder list request itself fails, the bad id stays in the URL and the page keeps showing "This folder is empty…" (the catch is silent).
- An empty room with a bad folder id → after the id is removed the first-run box shows.

#### STORY-DRM-027: Rename, move and delete folders

**Type**: medium
**Topic**: Folder housekeeping
**Persona**: Maya tidying a messy tree: top-level `Archive` (empty), top-level `Old drafts` (empty) with `2025` inside, and the classifier's `Finance / Vendor bills`.
**Goal**: Rename `Vendor bills` to `Supplier bills`, move it under `Legal`, delete `2025`, and delete the top-level `Old drafts` and `Archive`.
**Preconditions**: S1 + S5 with `Old drafts`, `2025`, `Archive` and `Finance / Vendor bills`. On main.
**Ideal path**: 3 — open the parent, use each folder's "…" menu.
**Alternate paths**: none found for top-level folders (see step 5).

##### Steps
1. In the tree, hover or right-click `Vendor bills` → nothing; tree entries have no menu. **Hesitation:** she looks for "Rename" and finds none.
2. Click `Finance` → Folder rows `Bank statements`, `Invoices`, `Vendor bills` appear above the files, each with "…" (aria "More actions for Vendor bills").
3. "…" then Rename on `Vendor bills` → dialog "Rename Vendor bills", type `Supplier bills`, Save → the row and the tree update.
4. "…" then Move → dialog "Move Supplier bills to" with "Top level" and every folder except itself and its descendants; choose `Legal`, Save. Then open `Old drafts`, "…" then Delete on `2025` → "Delete the folder 2025?" with "Only an empty folder can be deleted. This can't be undone." → Delete.
5. She tries to delete `Old drafts` and `Archive` themselves → only the sub-folders of the open folder get rows (`DataRoom.tsx:149-155`), and top-level folders have no parent to open, so these two folders have no "…" menu anywhere. She cannot rename, move or delete a top-level folder (see Suspected problems).
6. She tries to delete a folder that still holds files (`Legal` after the move) → not reachable either; for a nested one, red text "Move or delete what is in this folder first."

##### Variations
- Grid view: sub-folders are tiles above the file tiles, with the "…" at the top right.

##### Edge Cases
- Renaming or moving the folder that is currently open keeps the URL (same id).

#### STORY-DRM-028: A folder is deleted in another tab while it is open

**Type**: short
**Topic**: Folder in the URL (deleted elsewhere)
**Persona**: Maya with two tabs open on the Data room.
**Goal**: Keep working after the folder she is looking at disappears.
**Preconditions**: S1 + S5 with an empty folder `Archive`; the same Data room open in two tabs, both on `Archive`. On main.
**Ideal path**: 1 — the page recovers by itself.
**Alternate paths**: Reload.

##### Steps
1. In tab A, open the parent and delete `Archive` (it is empty) → "Deleted" toast.
2. In tab B (still on `Archive`) drop a file → Toast "Upload failed" because the folder is gone (404).
3. In tab B, rename or move something → the folder list reloads, the missing id is removed from the URL, and the page shows "All items".
4. In tab B, wait without doing anything → Nothing happens; the page does not poll folders.

##### Edge Cases
- Pressing Back in tab B after the id was removed goes to the previous entry, which may be a folder that no longer exists, repeating step 2 of STORY-DRM-026.

#### STORY-DRM-029: Open a document from a link or toast

**Type**: short
**Topic**: `?item=` deep link
**Persona**: Maya who clicks "View" in an upload toast, or follows a link from the sidebar search.
**Goal**: See that exact document.
**Preconditions**: S1. On main.
**Ideal path**: 1 — click "View".
**Alternate paths**: Sidebar search result (STORY-DRM-035).

##### Steps
1. Upload a file into `Investors` and click "View" in the toast → URL `/app/data-room?item=<id>&folder=<id>`: the folder `Investors` is selected and the file is open in the preview.
2. Click another folder → The `item` stays in the URL, the preview closes if the file is not in the new list.
3. Open `/app/data-room?item=nonexistent` → The Data room opens normally in "All items" with no preview and no message (`DataRoom.tsx:197-209`, the failure is swallowed). **Hesitation:** she thinks the link was broken.

##### Edge Cases
- An item beyond the first 50 in the list is still shown, because it is read by id.
- On a narrow page the preview opens as a dialog.

### Stories: Working on a phone and by keyboard

#### STORY-DRM-030: Use the Data room on a phone

**Type**: medium
**Topic**: Phone width
**Persona**: Maya on her phone in a taxi, who needs the lease.
**Goal**: Find the lease and download it.
**Preconditions**: S1; viewport about 390 px wide. On main.
**Ideal path**: 3 — search, tap, download.
**Alternate paths**: Folder pill.

##### Steps
1. Open Data room from the menu button → The title, the view toggles and "+" are on the first line.
2. Look under it → The search box is alone on its own line; below it one row that scrolls sideways: a folder pill ("All items"), the filters that have values, then "Sort: Recently added" at the right end (`FilterBar.tsx:217`). **Hesitation:** she does not realise the row scrolls.
3. Type "lease" → The list becomes results; the folder pill and Sort stay.
4. Tap a result → The preview opens as a dialog titled "Preview" with the file name, facets and Download (`DataRoom.tsx:471-482`). The "…" menu is inside it; there is no separate close X (the dialog's own close).
5. Tap Download → The file is saved. Press Escape or the dialog close → focus returns to the tapped row.
6. Tap the folder pill → A radio menu with full paths, such as "Legal / Contracts"; the pill itself shows only the last name.

##### Variations
- Between 560 and 800 px the preview sits beside the list but the tree is replaced by the pill.
- Toasts are centred with a 16 px gutter on a phone.

##### Edge Cases
- Widening the window while the dialog is open closes it (`DataRoom.tsx:187-189`).
- Tapping a row never opens the dialog from keyboard focus alone (`DataRoom.tsx:254`).

#### STORY-DRM-031: Keyboard only

**Type**: medium
**Topic**: Keyboard
**Persona**: Maya, who prefers the keyboard.
**Goal**: Find and download a statement without the mouse.
**Preconditions**: S1; desktop width. On main.
**Ideal path**: 2.
**Alternate paths**: none found.

##### Steps
1. Tab to the folder tree → "All items" is focused. Press Down Arrow twice → focus moves through folders; press Enter on `Bank statements` → that folder opens (URL updates).
2. Tab to the first row → Down and Up arrows move between rows and open the row in the preview as focus moves (`ItemRows.tsx:44-61`).
3. Press Enter or Space on a row → toggles the preview open or closed; pressing it on the shown row closes it.
4. Tab through the preview → "…" menu, Close preview, Download. Press Enter on Download.
5. Press Escape in the search box with text → clears it.

##### Edge Cases
- Right Arrow does not expand or collapse folders (there is no collapse).
- In the phone dialog, Escape closes it and puts focus back on the row.

### Stories: Consent without a model, new folder, hide amounts, search surfaces

#### STORY-DRM-032: No model is set up: the grey note

**Type**: short
**Topic**: Consent card (no recipients)
**Persona**: Maya, who skipped model setup.
**Goal**: Understand why files are not sorted.
**Preconditions**: S3; model M0; consent C0. On main.
**Ideal path**: 1 — read one clear sentence.
**Alternate paths**: none found.

##### Steps
1. Open Data room → A grey card (no button): "You can search documents by name and text and move them into folders yourself. Set up a model in Settings to have new files tagged and sorted into folders for you."
2. She looks for a link to Settings → The sentence is plain text; no link or button. **Hesitation:** "model" means nothing to her.
3. Outcome: she keeps the files unsorted or moves them by hand.

##### Edge Cases
- Setting a model in Settings and returning: the card becomes the Allow card after a reload (the status is read once per page visit).

#### STORY-DRM-033: Make a new folder while moving a file

**Type**: short
**Topic**: Move dialog, "New folder…"
**Persona**: Maya organising the SAFE and an advisor agreement.
**Goal**: Put both in a folder called `Advisors` that does not exist.
**Preconditions**: S1. On main.
**Ideal path**: 2 — Move, New folder…, name, Save.
**Alternate paths**: none found.

##### Steps
1. "…" → Move on the SAFE → Dialog "Move <name> to".
2. Choose "New folder…" at the end of the select → A text field "New folder name" appears and is focused.
3. Type `Advisors` and Save → The folder is created at the top level and the file moves into it. The tree shows `Advisors`.
4. Move the second file → `Advisors` is now in the select.

##### Variations
- A name with a slash → "Enter a folder name without slashes". She wanted `Legal / Advisors` and cannot create a nested folder this way: "New folder…" always creates a top-level folder (`ItemDialogs.tsx:146-151`).

##### Edge Cases
- The folder is created, then the move fails → the empty folder stays behind (two separate calls).

#### STORY-DRM-034: Hide amounts on documents

**Type**: short
**Topic**: Hide amounts
**Persona**: Maya sharing her screen on a call.
**Goal**: Keep invoice amounts off the screen.
**Preconditions**: S1; the "Hide amounts" preference turned on elsewhere in the app. On main.
**Ideal path**: 1.
**Alternate paths**: none found.

##### Steps
1. Open `Invoice NW-1042 Acme Servo Supply.pdf` → The preview Amount reads "$•••" instead of $18,750.00; dollar amounts in the summary are masked too.
2. Open a scanned image (png/jpg) → Instead of the picture: "Image hidden while amounts are hidden".
3. Turn the preference off → The amount and the picture return without reloading.

##### Edge Cases
- Amounts are not in the list columns, so the list needs no masking.
- The file name, if it contains an amount, is still shown.

#### STORY-DRM-035: Find a file from the sidebar search

**Type**: short
**Topic**: Sidebar search to Data room
**Persona**: Maya who uses the sidebar search for everything.
**Goal**: Jump to the lease from anywhere.
**Preconditions**: S1. On main.
**Ideal path**: 2.
**Alternate paths**: Data room page search.

##### Steps
1. Type "lease" in the sidebar search → A group of documents appears (up to 5) next to messages and pages.
2. Click `Northwind HQ lease renewal 2027.pdf` → The Data room opens at `?item=<id>` with the lease in the preview and its folder selected.

##### Edge Cases
- If the Data room search fails, the group is silently omitted (`Shell.tsx:1838-1840`).

#### STORY-DRM-036: Search while a folder is open

**Type**: short
**Topic**: Search + folder
**Persona**: Maya who opened `Investors` and then searched "lease".
**Goal**: Find the lease.
**Preconditions**: S1. On main.
**Ideal path**: 1 — search finds it wherever it is.
**Alternate paths**: Click "All items" first.

##### Steps
1. Open `Investors`, type "lease" → "No results". The folder is still applied to the search (`filters.folderId` is sent). **Hesitation:** she assumes search covers everything.
2. Nothing on screen says the search is limited to the folder except the highlighted tree entry (or the pill on a phone).
3. Click "All items" → The lease appears.

##### Edge Cases
- Result rows show "folder · source" but sub-folder rows are hidden during a search.

#### STORY-DRM-037: A library with many documents

**Type**: medium
**Topic**: Load more, list errors
**Persona**: Maya whose library has grown to more than 60 files.
**Goal**: See older documents, and recover from a failed load.
**Preconditions**: S4. On main.
**Ideal path**: 2.
**Alternate paths**: Search.

##### Steps
1. Open Data room → The first 50 files load; below them a "Load more" button.
2. Click "Load more" → The next page is added; the button disables while it loads.
3. While loading the first page, a skeleton of four grey bars shows.
4. Go offline and press "Load more" → A red error line with "Retry" appears above the list.
5. Reconnect and press "Retry" → The list reloads from the top.

##### Variations
- Search results load 20 at a time.
- The Type and Party menus list only what has been loaded so far.

##### Edge Cases
- A search whose paging cursor no longer fits restarts quietly (`use-data-room-list.ts:143-150`).

#### STORY-DRM-038: Grid view with sub-folder tiles

**Type**: short
**Topic**: Grid + folders
**Persona**: Maya who prefers tiles.
**Goal**: Move through `Finance` in grid view.
**Preconditions**: S1; grid view. On main.
**Ideal path**: 2.
**Alternate paths**: List view.

##### Steps
1. Click `Finance` → Two folder tiles `Bank statements` and `Invoices` (label "Folder") above any file tiles.
2. Click the `Invoices` tile → The folder opens (URL updates).
3. Use the tile's "…" → Move / Rename / Delete (STORY-DRM-027).

##### Edge Cases
- A folder with no files and no sub-folders → "This folder is empty. Drop files here to add them."

### Stories: PR #109 import edge cases and agents (Requires PR #109, `f2b8fc1e`)

#### STORY-DRM-039: The email picker has problems

**Type**: medium
**Topic**: Email import errors and limits
**Persona**: Maya importing attachments when mail is not perfect.
**Goal**: Import what she can and understand what failed.
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** S1; Gmail connected with threads: one with a PDF, one with only a 4 kB logo and a calendar invite, one account needing reconnect.
**Ideal path**: 3.
**Alternate paths**: Download and upload.

##### Steps
1. Click the envelope → Dialog "Import from email"; mail with attachments is listed.
2. Open the thread with the logo → Its files are listed; she can tick them (the dialog does not filter out logos). Tick the logo and press Import → That file is stored, but agents skip such files; she sees "Imported 1 file" (it is her choice here).
3. Open a thread with no usable attachments → "No files found".
4. Tick 20 files across threads → All other checkboxes become disabled (cap of 20).
5. If one account needs reconnecting and nothing else loads → Red text "Couldn't load mail" (or the specific reason) and a "Reconnect" link to the Gmail integration page.
6. An import where one of three fails → The dialog stays open with "Couldn't import 1 file" and the successful files are already in the list.

##### Edge Cases
- Search box empty and no mail with attachments → "No files found".
- Closing the dialog loses the ticks.

#### STORY-DRM-040: Browse Drive and meet unsupported files

**Type**: medium
**Topic**: Drive picker behaviour
**Persona**: Maya hunting for a contract in a big Drive.
**Goal**: Find and import it, and understand why some files cannot be ticked.
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** Drive connected; Drive has a Google Form `Customer survey`, a large video, and a Google Doc.
**Ideal path**: 3.
**Alternate paths**: Search.

##### Steps
1. Open the Drive dialog and open two folders deep → The back arrow goes up one level at a time.
2. Look at `Customer survey` (a Google Form) → Its checkbox is disabled with no explanation (`ImportFromDrive.tsx:44-47`). **Hesitation:** she wonders why this file is locked.
3. Tick a Google Doc → Allowed (becomes a PDF).
4. Tick the video above 50 MB → The import ends with "Couldn't import 1 file" for that file.
5. Tick 20 files → The rest become disabled.
6. Type in "Search Drive" → Results across Drive; the back arrow hides.

##### Edge Cases
- If more than one Drive account is connected the first one is used; she cannot choose.
- Drive account needs reconnecting → the dialog shows the error text from the server.

#### STORY-DRM-041: Connect Gmail or Drive first

**Type**: short
**Topic**: Import buttons when not connected
**Persona**: Maya who has not connected Google.
**Goal**: Import her mail attachments.
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** No Gmail or Drive connection.
**Ideal path**: 2.
**Alternate paths**: none found.

##### Steps
1. Open the empty Data room → Buttons "Choose files", "Connect Gmail", "Connect Google Drive".
2. Click "Connect Gmail" → The integration page `/app/integrations/app/google/gmail` opens.
3. Connect, return to the Data room → The button now reads "Import from email" (the connection list is read when the page opens).

##### Edge Cases
- The buttons appear only after the connection list loads; before that, neither shows (the page seems to gain buttons).
- The connections request fails → both read "Connect …" even if she is connected.

#### STORY-DRM-042: Source links on imported files

**Type**: short
**Topic**: Preview source link
**Persona**: Maya who wants to see where a file came from.
**Goal**: Open the original email or Drive file.
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** One imported mail file and one imported Drive file.
**Ideal path**: 1.
**Alternate paths**: none found.

##### Steps
1. Open the imported invoice → Source reads "From email" as a link.
2. Click it → She lands on the original message in the Inbox.
3. Open the Drive file → Source reads "From Google Drive"; clicking opens Drive in a new tab.
4. Open an uploaded file → Source is plain "Upload".

##### Edge Cases
- Sharing a file's link with another member: the Inbox link opens Maya's own mail and will not work for them.

#### STORY-DRM-043: Import into the folder she has open

**Type**: short
**Topic**: Import destination
**Persona**: Maya has `Finance / Invoices` open.
**Goal**: The imported invoice lands there.
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** S1; Gmail connected.
**Ideal path**: 2.
**Alternate paths**: Move afterwards.

##### Steps
1. Open `Invoices`, click the envelope, import `invoice-1044.pdf` → The import carries the open folder (`ImportSources folderId={filters.folderId}`).
2. The list reloads → The new invoice is in `Invoices`.
3. From the empty first-run box the destination is always the root.

##### Edge Cases
- The open folder was deleted elsewhere → the server answers 404 and the dialog shows an error.

#### STORY-DRM-044: An agent files an attachment on its own

**Type**: medium
**Topic**: `add_to_data_room`
**Persona**: Maya whose Inbox agent reads her mail.
**Goal**: Have invoices filed without asking.
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** S1; consent C1 (and C0 for the variation); the Inbox agent runs on her mail with the Acme thread.
**Ideal path**: 1.
**Alternate paths**: Manual import (STORY-DRM-020).

##### Steps
1. The Inbox agent reads the Acme thread → Its instructions tell it to add documents it finds without being asked (`DATA_ROOM_GUIDANCE`). It calls `add_to_data_room` with the message and attachment ids; no approval card appears.
2. The agent reports "Added invoice-1044.pdf to the Data room."
3. Maya opens the Data room → A new row, source Gmail ("From email"), with no folder; reading and filing follow the consent state.
4. The same email's 4 kB logo → the tool answers "Not a document." and nothing is added.
5. Running the tool a second time → "… is already in the Data room."

##### Variations
- Consent C0 → the tool answers "The Data room is off for this person." and nothing is stored; the agent is told to mention it at most once.

##### Edge Cases
- The tool is not offered in group chats or messaging-channel runs.
- Items from a connection Maya denied the agent stay hidden from it.

### Gaps & Recommendations
- Sharing (STORY-DRM-022), the "Ask agent" button, the Data room agent and its side panel, undo or trash, retry of a failed file, folder menus in the tree, bulk download and a nested "New folder…" are not built on either branch.
- Re-run the PR #109 stories once it merges; on current main the import buttons and agent tools do not exist.
- Unverified in code: what a signed-out visitor sees when opening a `?folder=` link (STORY-DRM-024), and the exact copy of the Hide-amounts toggle.

### Redundancy Candidates (this area)
- Three ways to start an upload (header "+", "Choose files" in the empty state, drop anywhere) plus, with PR #109, two import buttons: four add-file buttons in one header row that look alike (STORY-DRM-002, 020).
- The folder pill (narrow) and the folder tree (wide) are two controls for one choice; a sub-folder row or tile is a third (STORY-DRM-011, 030, 038).
- "Move" with "New folder…" and the (absent) tree menu: folder creation lives only inside the Move dialog, so there is no obvious place to make a folder (STORY-DRM-033).
- Sidebar search and the page's own search both search documents, with different result layouts (STORY-DRM-013, 035).
- The Settings "AI data sharing" switches and the Data room "Allow" card both talk about sending documents to a model; the Data room needs its own consent (STORY-DRM-009).

### Suspected problems (this area)
1. **Top-level folders cannot be renamed, moved or deleted.** Only the open folder's children get rows with a "…" menu (`DataRoom.tsx:149-155`), and the tree has no menu (`FolderTree.tsx`). A top-level folder is nobody's child, so no menu reaches it. STORY-DRM-027.
2. **"New folder…" always creates a top-level folder** (`ItemDialogs.tsx:146-151` calls `folderCreate({ name })` with no parent), so nested folders can only come from the classifier. STORY-DRM-033.
3. **A folder shows only its own files, not those of its sub-folders** (`packages/db/src/data-room.ts:168-172`, equality on `folderId`). Clicking `Finance` shows only folder rows. STORY-DRM-011.
4. **Search silently stays inside the open folder.** The folder filter is sent with the search (`use-data-room-list.ts:79-84`); nothing in the results says so. STORY-DRM-036.
5. **Upload to a deleted folder says "Upload failed"** with no hint about the folder (`apps/api/src/data-room.ts:396-402` returns 404; `upload-toasts.ts:136-144` maps it to "failed"). STORY-DRM-006, 028.
6. **A bad `?item=` id is ignored silently** (`DataRoom.tsx:209`), and a failed folder-list request leaves a bad `?folder=` id in the URL with "This folder is empty…" showing. STORY-DRM-026, 029.
7. **Type and Party menus list only values on the rows already loaded** (`DataRoom.tsx:375-376`), so a type that lives on page 2 is not offered. STORY-DRM-014, 037.
8. **A failed file has no retry**; the preview offers Delete and Download only (`Preview.tsx:174-184`). STORY-DRM-008.
9. **Consent card has no "Not now" and no link to Settings in the no-model note** (`ConsentPrompt.tsx:26-34`, `ConsentCard` called without `onDismiss`). STORY-DRM-009, 032.
10. **Search and non-folder filters are not in the URL** (`DataRoom.tsx:83-85`), so Back and links do not restore them. STORY-DRM-025.
11. **PR #109: import buttons are icon-only with an aria label but no visible tooltip** (`ImportFromEmail.tsx` `compact`, `ImportFromDrive.tsx`); a sighted first-timer sees an envelope and a disk. STORY-DRM-020.
12. **PR #109: the import notice and the upload toasts occupy the same corner** (`DataRoom.tsx` notice `fixed end-4 bottom-20 z-100`; `DropZone.tsx` toasts `fixed inset-x-4 bottom-20 z-100`), so they can overlap if both are visible. STORY-DRM-020.
13. **PR #109: Drive picker disables unsupported files with no explanation** (`ImportFromDrive.tsx:44-47`), and uses the first connected Drive account with no chooser. STORY-DRM-040.
14. **PR #109: the connection list is read once**; the import buttons do not appear until it loads, and a failed read shows "Connect …" even when connected (`ImportFromEmail.tsx:289-305`). STORY-DRM-041.


---

## Area: App shell A (STORY-APP-nnn)

Generated: 2026-10-17
Code read at: `rakazo-ux` branch `docs/ux-pass`, commit `559a76ad`. All file:line references are to `apps/web/src/` unless another root is given.
Total Stories: 55 (34 short, 17 medium, 4 long)
Scope (part A): sign-up, sign-in and password reset; Welcome and Onboarding (every step and the focus card); Paywall and `SubscriptionGate`; sidebar and navigation (Shell, `SidebarPages`, `AddSidebarPage`, bot ordering, hide/show sidebar, phone drawer); Cmd+K palette and sidebar search; notifications and the Activity list; the Hide amounts toggle; the Artifacts page and chat file cards; agent and settings panels at phone width; window chrome and desktop updates; error boundaries and unknown URLs.
Not in part A (part B owns them): chat composer, hover actions, tables, mentions, bot create/settings, groups and spaces dialogs, Integrations, Settings sections, billing/usage panels, team/members, and the prior end-to-end stories APP-024 and APP-025.

### Changes since the 2026-10-16 catalog

The Shell was reworked after the earlier catalog (commits `bca9a32b`, `72feab12`, `5b0b1dcf`, `b008c2f2`, `1010ad09`, `42bd9d96`, `cc5265f1` and the `ux/*` merges). Many steps in the earlier stories were wrong by now.

**Kept (id unchanged, steps rewritten):**
- STORY-APP-001: sign-up to first chat. New Welcome copy, "Create your account", scripted Chief greeting, five focus choices, "Authorize" button on connect cards, Artifacts now in the sidebar.
- STORY-APP-002: focus card. The old gap is closed: "Run my company" now exists as choice A. Rewritten around what that choice does and where it still falls short.
- STORY-APP-003: sign in and password reset. New "Check your email" screen with "Send again", "Enter a valid email" check, sign-in options loading state.
- STORY-APP-004: paywall. Title is now the price when known, trial button text, recheck on window focus.
- STORY-APP-005: sidebar orientation. Artifacts, Settings, Hide amounts and Usage moved; labels now "Hide sidebar", "Search chats", "Cap table", "Create".
- STORY-APP-006: finding the investor update. Artifacts now has a sidebar link, and search and Cmd+K find it by name.
- STORY-APP-007: sidebar search. Results are now grouped (Pages, Documents, Mail, Chats).
- STORY-APP-008: Cmd+K. The old claim "bots only" is wrong: it now lists bots, groups and pages, titled "Go to".
- STORY-APP-009: hide/show sidebar and phone drawer. New labels, edge handle, swipe-from-edge.

**Dropped:** none. Every earlier story in this range still has a code path.

**Added (STORY-APP-101 to STORY-APP-146):** sign-in edge cases (101-107), onboarding steps and failures (108-112), paywall variants (113-115), bot ordering, two-space sidebar, the dormant "Add page" row, richer search and palette (116-123), notifications and Activity (124-127), Hide amounts (128), Artifacts (129-133), panels at phone width (134-136), window chrome and updates (137-139), unknown URLs and error screens (140-143), and three long journeys (144-146).

**Overlap with part B to settle at merge:** prior STORY-APP-016 (part B) covers browser notifications and the Activity bell. Stories 124-127 here re-walk those from the shell's side with corrected facts (the Activity list no longer replaces the bot list; "needs input" is not a notification event). The assembler should keep one version.

### Persona (applies to every story)

Maya Chen, cofounder and CEO of "Northwind Robotics" (a 9-person warehouse-robotics startup). She has never seen Praci. She does not know the words "bot", "agent", "space", "group", "triage", "routine", "artifact", "Data room", "approval" or "provider". She wants one place to run the company: read email, know the cash position, keep the cap table and investor documents straight, and hand repeat work to someone reliable. **Hesitation** marks where she would pause or misread. "Expects" gives the outcome a first-timer would assume.

### Mock demo data and preconditions (shared seed)

Every user-visible string in the seed contains `MOCK DEMO DATA`.

| Seed item | Value |
|---|---|
| User | Maya Chen, `maya@northwind.example` (MOCK), password set |
| New user (sign-up stories) | `maya.new@northwind.example` (MOCK), no account yet |
| Space | "Northwind Robotics" (default). Second space "Side project" only where a story says so |
| Bots | "Chief" (first bot, onboarding done), "MOCK Finance helper", "MOCK Hiring helper", archived "MOCK Old intern bot"; page agents "Inbox agent", "Finance agent", "Carta agent" once created |
| Group / section | Group "Leadership" (Chief and Finance helper); section "MOCK Ops" |
| Chief thread | 12+ messages, one saying "MOCK DEMO DATA SAFE discount 20%" |
| Inbox | 20 cached MOCK messages, 3 unread |
| Data room | 3 MOCK documents, e.g. "Seed SAFE.pdf" |
| Artifacts | 6 MOCK artifacts made by Chief and the Finance helper, among them "Q3 investor update draft" (3 versions, Markdown), "Board deck.pdf", "Runway dashboard.html" |
| Activity | 1 running run, 1 "Needs input" run, 4 finished runs |
| Server | Billing enabled for paywall stories (second account with no subscription); password reset configured; SSO provider "MOCK Okta" only for story 104 |
| Browser | Notification permission "default" unless a story says otherwise; storage enabled |

### Summary

| Type | Count |
|---|---|
| Short | 34 |
| Medium | 17 |
| Long | 4 |

### Coverage Matrix

| Feature | Stories | Gaps |
|---|---|---|
| Welcome page | 001, 106, 107 | None |
| Sign up (password) | 001, 101, 102 | Name field optional (falls back to email local part), not walked on its own |
| Sign in / out | 003, 105, 106, 107 | None |
| Password reset | 003, 103 | None |
| SSO | 104 | Needs an SSO server; code-read only |
| Onboarding: model step | 108 | OAuth "subscription sign-in" and Cloudflare gateway fields only named |
| Onboarding: server integrations step | 109, 146 | Owner only |
| Onboarding: first bot and greeting | 001, 112, 144 | None |
| Onboarding: focus card (all five choices, dismiss) | 002, 110 | "Research & writing" and "A bit of everything" only as variations |
| Onboarding: app connect cards | 001, 111 | Pipedream-managed provider not covered |
| Paywall / SubscriptionGate | 004, 113, 114, 115 | Checkout page itself is outside the app |
| Sidebar: fixed links, bot list, archived | 005, 118 | Pinned rows and "Mark as unread" are in part B |
| Sidebar: ordering, sections, nested bots | 116 | Cross-section drag is not supported by code; noted |
| Sidebar: two spaces | 117 | None |
| Add page row | 118 | Dormant in this build (only template is unavailable) |
| Sidebar search | 007, 119 | None |
| Cmd+K palette | 008, 120 | None |
| Hide/show sidebar, drawer, swipe | 009, 121, 122, 123 | RTL swipe only noted |
| Notifications: browser | 126, 127 | Desktop (Electron) notification bridge not found in web code |
| Activity list (bell) | 124, 125 | None |
| Hide amounts | 128 | Mobile app is out of scope |
| Artifacts page | 006, 129, 130, 131, 132 | Image preview not walked |
| Chat file card (ArtifactFileCard) | 133 | None |
| Panels at phone width | 134, 135, 136 | Group settings panel is a part B story |
| Window chrome | 137 | macOS traffic lights are native, not testable in web |
| Desktop updates | 138 | Needs the Electron bridge |
| Web software update | 139 | Owner only |
| Unknown URLs, error screens | 140, 141, 142, 143 | None |

### Story Dependency Graph

```text
STORY-APP-001 (Sign up -> first chat)               needs: no account
|-- STORY-APP-002 (Focus card: Run my company)
|-- STORY-APP-110 (Ignore the focus card)
|-- STORY-APP-111 (Connect card failures)
|-- STORY-APP-112 (Onboarding interrupted)
|-- STORY-APP-005 (Orient in sidebar)
|   |-- STORY-APP-006 (Find the investor update)
|   |   `-- STORY-APP-129..133 (Artifacts)
|   |-- STORY-APP-007 -> 119 (Search)
|   |-- STORY-APP-008 -> 120 (Cmd+K)
|   |-- STORY-APP-009 -> 121, 122, 123 (Hide sidebar, drawer, keyboard)
|   |-- STORY-APP-116 (Reorder), 117 (Two spaces), 118 (Add page)
|   `-- STORY-APP-124..127 (Activity and notifications)
|-- STORY-APP-128 (Hide amounts)
|-- STORY-APP-134, 135, 136 (Panels)
`-- STORY-APP-144, 145 (long journeys; need full seed)
STORY-APP-003, 101..107 need only an account or none.
STORY-APP-108, 109, 146 need a server with no model or no integration setup.
STORY-APP-004, 113, 114, 115 need billing on and an unsubscribed account.
STORY-APP-137..143 need nothing from the seed.
```

### Stories: Sign-up, sign-in and password reset

#### STORY-APP-001: Maya signs up and gets to her first useful chat

**Type**: long
**Topic**: Sign-up and onboarding
**Persona**: Naive first-time founder (Maya Chen)
**Goal**: "Create an account and get something that helps me run Northwind."
**Preconditions**: No account for `maya.new@northwind.example` (MOCK). Server already has a deployment model (`me.needsModel=false`) and no integration setup is needed. Composio is configured so Chief's connect cards appear. Variants B and C are separate stories (108, 109).
**Ideal path**: 5 — Sign up, fill the form, pick a focus, authorize one app, ask a question. A product for founders should not ask for model or server setup in the first minute.
**Alternate paths**: `/sign-in` then "Sign up" (`pages/Auth.tsx:318-325`); direct `/sign-up`. After sign-up the router sends a signed-in user to `/onboarding` (`App.tsx:145`).

##### Steps
1. Opens `/`. Sees the Praci logo, "Bots that run your inbox, cash, cap table and investor documents." and two controls, "Sign up →" and "Sign in" (`pages/Welcome.tsx:22-43`). Expects a short explanation or a demo. **Hesitation:** "Bots" is the only noun; she wonders if this is a chatbot or software she must configure. The copy does name her four jobs (inbox, cash, cap table, investor documents), which is better than before.
2. Clicks "Sign up". Sees "Create your account" with Name ("Your name"), Email ("Your email address"), Password and the hint "At least 8 characters." (`pages/Auth.tsx:214-280`). A brief "Loading…" shows first while the server reports which sign-in methods exist (`:192-196`).
3. Types Name "Maya Chen", Email "maya.new@northwind.example", a password. Clicks the eye button ("Show password") to check the typing; the label flips to "Hide password" (`:264-274`).
4. Clicks "Create account". The button reads "Working…" while it runs, then the app goes to `/onboarding` (`:295-305`, `:114-121`). She sees "Loading…" and then "Opening chat…" (`pages/Onboarding.tsx:559,1046`). **Hesitation:** two plain loading screens in a row with no sign that her account was made.
5. Lands on `/app/<chiefId>` in a thread with the bot "Chief". The first message reads "Hi Maya, I'm Chief. I can sort your email, keep an eye on cash and the cap table, find investor documents in the Data room, and draft updates and research for you." (`apps/api/src/onboarding.ts:119-131`). **Hesitation:** "Data room" is still unexplained, but she can see it in the sidebar.
6. Under it, a card asks "What do you want me on first?" with A "Run my company", B "Day-to-day work", C "Inbox & email", D "Research & writing", E "A bit of everything", and an X ("Dismiss") in the corner (`pages/shell/message-cards.tsx:77-125`, options at `apps/api/src/onboarding.ts:34-71`). She picks A (see STORY-APP-002 for what follows).
7. Chief replies with a short text, then a card per app. Each card has the app logo, name, a one-line description and an "Authorize" button (`message-cards.tsx:206-235`). She clicks "Authorize" on Gmail. The button reads "Waiting…" and a popup opens to Google. She approves with the MOCK account; the card switches to "Connected" (`:208-212`).
8. Types "What should I look at first today?" in the composer and presses Enter. A reply streams in.
9. Looks at the sidebar from top to bottom: bell, hide-sidebar icon and "+" in the top row; a "Search chats" box; Inbox, Finance, Cap table, Data room, Artifacts; the bot list with Chief; Integrations; her initials and "Maya Chen" (`pages/Shell.tsx:3354-3532,4058-4080`). She now has a map of the product.

##### Variations
- SSO configured next to passwords: a small "Continue with {name}" link appears under the form (`pages/Auth.tsx:306-317`).
- Browser autofill fills Name and Email; the Name field is optional. If left empty, the name becomes the part of the email before "@" (`:103`), so Chief greets her as "Hi maya.new".
- Phone width (390px): the same flow in a single column; sidebar is a drawer (see STORY-APP-121).

##### Edge Cases
- Bot creation fails: the onboarding page shows "Could not create your bot" with "Try again" (`pages/Onboarding.tsx:546,1041`). See STORY-APP-112.
- Visiting `/sign-up` while signed in goes straight to `/onboarding`, and from there to the existing Chief (`App.tsx:145`, `Onboarding.tsx:60-76`).
- Email verification required: see STORY-APP-102.

#### STORY-APP-002: Maya picks "Run my company" on the focus card

**Type**: short
**Topic**: Onboarding focus card
**Persona**: Naive first-time founder
**Goal**: "Tell the assistant I want help with finance, the cap table and investor docs."
**Preconditions**: Fresh Chief thread with the unanswered focus card. Composio catalog has Gmail and Google Calendar.
**Ideal path**: 2 — read the choices, click A. The earlier gap (no company-wide option) is closed.
**Alternate paths**: Dismiss the card and type the request (STORY-APP-110).

##### Steps
1. Reads A "Run my company", B "Day-to-day work", C "Inbox & email", D "Research & writing", E "A bit of everything" (`apps/api/src/onboarding.ts:34-71`). Expects A to cover finance, cap table and investor documents. The card shows only the label; the summary "cash, cap table, investors, and email" is not shown until after she chooses. **Hesitation:** she cannot tell how A differs from E.
2. Clicks A. The card collapses to just her choice with a check mark, other choices are hidden (`message-cards.tsx:102-123`).
3. Chief replies "Got it. Cash, cap table, investors, and email. I'll see what's already connected so I don't make you set something up twice." then "Gmail and Google Calendar are a good place to start. Connect them here and I'll use what you already have." and two connect cards, then "Hit those two and I'll start pulling the picture." (`onboarding.ts:285-343`).
4. A last message says: "For cash and equity, open Finance and Cap table in the sidebar to connect your bank, card, and Carta. Board decks and investor documents go in the Data room." (`onboarding.ts:44`). She clicks Finance in the sidebar and sees the page that asks for a bank connection. **Hesitation:** Chief's apps are Gmail and Calendar only; bank, Carta and documents are connected somewhere else. She expected Chief to ask for those here.

##### Variations
- B offers Slack, Gmail and Google Calendar. C offers Gmail, Calendar and Slack (same apps, different order). D offers Hacker News, Notion and Google Docs, which looks odd for a company operator. E offers Gmail, Slack and Google Docs.
- If the catalog has none of the named apps, Chief posts only the note, or "What would you like to work on first?" (`onboarding.ts:327-332`).

##### Edge Cases
- Saving the choice fails: "Could not save this choice" under the options; dismiss fails: "Could not dismiss" (`message-cards.tsx:37,52`).
- The card is answered once. A second click is blocked because all options are disabled after an answer (`:90-96`).

#### STORY-APP-003: Maya signs in on a new laptop and forgets her password

**Type**: short
**Topic**: Sign-in and password reset
**Persona**: Returning founder
**Goal**: "Get back into my account."
**Preconditions**: Maya's MOCK account exists; server has password reset configured and email delivery works.
**Ideal path**: 4 — Sign in, "Forgot password?", enter email, click the emailed link and set a password.
**Alternate paths**: `/forgot-password` directly. Settings → Password only while signed in (part B).

##### Steps
1. Opens `/sign-in`: "Sign in to Praci", Email, Password, "Continue with email", and below "Don't have an account? Sign up" (`pages/Auth.tsx:43,295-325`). Types a wrong password. Sees a red message under the fields (`authErrorText`, `lib/user-error.ts:15-31`). **Hesitation:** the button says "Continue with email" though she is typing her email and password; she may think it sends a code.
2. Clicks "Forgot password?" under the password box (`:281-287`). The page becomes "Reset your password" with only Email and "Send reset link".
3. Types her email and clicks "Send reset link". The page changes to "Check your email" with: "If maya@northwind.example has an account, a reset link is on its way. It can take a minute; check your spam folder if it does not arrive." plus "Send again" and "Back to sign in" (`:153-176`).
4. Opens the email, clicks the link: "Choose a new password" with "New password" and "Confirm password" and "Reset password" (`:347-428`). Enters the same password twice.
5. Sees "Password updated" and a "Sign in" link. Signs in; lands on `/app` (Chief or her first bot).

##### Variations
- Reset not configured on this server: "Forgot password?" is hidden (`:281`). If she reaches `/forgot-password` anyway, submit shows "Password recovery is not configured for this server" (`:82-83`).

##### Edge Cases
- Empty or invalid email on any form shows "Enter a valid email"; empty password shows "Enter a password" (`user-error.ts:10-12`, `Auth.tsx:73-77`).
- Server unreachable on submit: "Could not reach the server" (`:123`).
- Expired link: see STORY-APP-103.

#### STORY-APP-004: A founder without a subscription hits the paywall

**Type**: short
**Topic**: Paywall
**Persona**: Naive first-time founder
**Goal**: "Start using it."
**Preconditions**: Billing enabled on the server; account "Paywall tester" with no subscription and permission to manage billing.
**Ideal path**: 2 — click the trial button, finish checkout.
**Alternate paths**: "Manage billing" appears only for past-due, incomplete or canceled customers (STORY-APP-115).

##### Steps
1. Signs in. Every `/onboarding` and `/app` route is wrapped by `SubscriptionGate` (`App.tsx:172-180`), which checks the server's sign-in options and then billing status (`components/SubscriptionGate.tsx:44-58`). While it checks, she sees the shell skeleton ("Opening your Space…") (`App.tsx:282-317`).
2. Sees the paywall. The heading is the price when known, for example "$29 / month" (`lib/billing.ts:8-21`, `pages/Paywall.tsx:44-47`), otherwise "Subscription required". Below: four check-marked lines: "Bots with their own computer and browser", "Routines that run while you're away", "Any model, with your own key", "Web, desktop and mobile apps" (`Paywall.tsx:38-43`). **Hesitation:** "Any model, with your own key" suggests she must bring and pay for a model key on top of the subscription. "Routines" is new vocabulary.
3. Clicks "Start 14-day free trial" (or "Subscribe" if no trial is available) (`:73-80`). The browser goes to the billing page. On desktop the system browser opens and this page stays.
4. Finishes checkout and returns. See STORY-APP-114 for how the gate notices.

##### Variations
- "Log out" at the bottom of the paywall signs her out and goes to `/` (`:94-106`).

##### Edge Cases
- Checkout cannot open: "Could not open billing" in red above the list (`:30,58-62`).
- The status lookup itself fails: the gate lets her into the app instead (`SubscriptionGate.tsx:51`); the server enforces access.

#### STORY-APP-101: Maya makes mistakes on the sign-up form

**Type**: short
**Topic**: Sign-up validation
**Persona**: Naive first-time founder, typing on a phone
**Goal**: "Just get my account made."
**Preconditions**: Sign-up page. A second MOCK account `maya@northwind.example` already exists.
**Ideal path**: 1 — a clear message beside the field that is wrong.
**Alternate paths**: none found.

##### Steps
1. Types "maya" (no @) as the email, a 6-character password, presses "Create account". The browser itself blocks the submit with its own tooltip, because the fields are `type="email"`, `required` and `minLength={8}` (`pages/Auth.tsx:241-242,260-261`). Message wording and position depend on the browser. **Hesitation:** on some phones the tooltip appears off screen.
2. Fixes both. Uses `maya@northwind.example` (taken). Clicks "Create account". Red text appears above the button with the server's reason, or "Could not continue" if the reason is technical (`:290-294`, `user-error.ts:100-110`). **Hesitation:** if the message only says "Could not continue" she does not know she should sign in instead. The page shows "Already have an account? Sign in" below, which helps.
3. Clicks "Sign in" in that line and enters the same email; the form is empty again (the page remounts, `App.tsx:140-145`).

##### Variations
- "Registration is closed" or "Email is not allowed to register" (`user-error.ts:19-20`) on locked-down servers.

##### Edge Cases
- Double-click on "Create account": the button is disabled while "Working…" (`Auth.tsx:295`).

#### STORY-APP-102: The server asks Maya to verify her email

**Type**: short
**Topic**: Sign-up, email verification
**Persona**: Naive first-time founder
**Goal**: "Finish creating my account."
**Preconditions**: Server requires email verification (`signupRequiresEmailVerification`).
**Ideal path**: 3 — see the screen, open the email, click the link.
**Alternate paths**: none found.

##### Steps
1. Submits the sign-up form. The page title becomes "Check your email" and the URL gets `?verify=email` (`pages/Auth.tsx:110-113,35,40-41`). **Hesitation:** under the title there is only a "Back to sign in" link (`:153-176`). No sentence says which address got the email, no spam hint and no "Send again" button. The explanatory text and "Send again" exist only on the password-reset path (`resetSent`).
2. Opens the email, clicks the link, comes back signed in or at sign-in.
3. If she closes the tab and returns to `/sign-up`, the form is empty and she has no record of whether the account exists.

##### Edge Cases
- The email never arrives: the screen offers no recovery. She must try signing in, which may say "Email verification required" (`user-error.ts:21-22`).

#### STORY-APP-103: Maya opens an old password-reset link

**Type**: short
**Topic**: Password reset, failure
**Persona**: Returning founder
**Goal**: "Reset my password."
**Preconditions**: A reset link older than the server's limit, or an already used one.
**Ideal path**: 2 — read the error, request a new link.
**Alternate paths**: Click "Back to sign in" and start again.

##### Steps
1. Clicks the old link. `/reset-password?error=...` shows "Choose a new password" with a red line "This reset link is invalid or expired" already visible (`pages/Auth.tsx:354-356`). The two password boxes are still there. **Hesitation:** the form looks usable, but "Reset password" is enabled only when a token exists (`:416`). She may type a password into a form that cannot work.
2. Clicks "Back to sign in" (`:421`), then "Forgot password?" and requests a new link; the "Check your email" screen offers "Send again" if the first email is slow (`:168-170`).

##### Edge Cases
- Passwords differ: "Passwords do not match" (`:363`).
- Link works but the server refuses: "Could not reset password" or the server's reason (`:371`).

#### STORY-APP-104: Maya's company signs in with SSO only

**Type**: short
**Topic**: SSO
**Persona**: Employee of a company that runs Praci on its own server
**Goal**: "Sign in with my work login."
**Preconditions**: Server has SSO provider "MOCK Okta" and password sign-in turned off.
**Ideal path**: 2 — click the SSO button, approve.
**Alternate paths**: none found.

##### Steps
1. Opens `/sign-in`. The title is "Sign in to Praci" and there is a single large button "Continue with MOCK Okta"; no email or password fields (`pages/Auth.tsx:197-206`).
2. Clicks it. A sign-in window or redirect opens (`lib/sso-flow`, `Auth.tsx:129-149`). On success she lands at `/app`; a new user lands at `/onboarding`.
3. A failure shows red text: "SSO is temporarily unavailable. Try again.", or "Sign in to your existing account to link SSO" when the same email already has a password account (`user-error.ts:17-18`). **Hesitation:** the second message names no way to sign in to the existing account, because password sign-in is off.

##### Edge Cases
- On `/sign-up` with SSO only, the same button appears; there is no separate create step.

#### STORY-APP-105: The sign-in page cannot load its options

**Type**: short
**Topic**: Sign-in, failure
**Persona**: Returning founder on weak hotel Wi-Fi
**Goal**: "Sign in."
**Preconditions**: The request for sign-in options fails (server slow or offline).
**Ideal path**: 2 — read the message, press Retry.
**Alternate paths**: Reload the page.

##### Steps
1. Opens `/sign-in`. The form is not shown; instead "Loading…" appears (`pages/Auth.tsx:192-196`).
2. After the request fails, the message "Could not load sign-in options" and a "Retry" button replace it (`:179-191`). She presses Retry; the options request runs again.
3. Wi-Fi returns; the form appears with Email, Password and "Continue with email".

##### Edge Cases
- She submits while options are missing: nothing happens, because the form is not rendered (`submit` returns when `reset?.passwordAuth` is falsy, `:72`).

#### STORY-APP-106: Maya opens a saved link while signed out, and a signed-in tab opens the welcome page

**Type**: short
**Topic**: Routing and redirects
**Persona**: Returning founder
**Goal**: "Open the Finance page link my cofounder pasted."
**Preconditions**: Maya is signed out. Link: `/app/finance`.
**Ideal path**: 2 — sign in and land on Finance.
**Alternate paths**: none found.

##### Steps
1. Opens `/app/finance` signed out. She is sent to `/sign-in` with nothing remembered about where she wanted to go (`App.tsx:180-182`). Only `/integrations/setup` keeps a `?next=` target (`App.tsx:96-97,165-170`).
2. Signs in. She lands on `/app` and the first bot, not Finance (`pages/Auth.tsx:115-121`). **Hesitation:** she expects the link she clicked to open; she has to find Finance in the sidebar again.
3. In another tab already signed in, she opens `/`. The app skips the Welcome page and goes straight to `/app` (`App.tsx:136`). `/sign-in` and `/forgot-password` do the same.

##### Edge Cases
- `/sign-up` while signed in goes to `/onboarding`, not `/app` (`App.tsx:145`).

#### STORY-APP-107: Maya logs out and signs back in on a shared computer

**Type**: short
**Topic**: Sign-out
**Persona**: Founder on a co-working PC
**Goal**: "Leave nothing behind."
**Preconditions**: Signed in, Chief open.
**Ideal path**: 3 — open the account menu, "Log out", confirm she is signed out.
**Alternate paths**: "Log out" on the paywall (STORY-APP-004).

##### Steps
1. Clicks her initials and "Maya Chen" at the bottom of the sidebar (`pages/Shell.tsx:4077-4080`). A menu opens upward with Settings, "Hide amounts", Usage and "Log out" (and "Task board" only if enabled) (`:4084-4146`).
2. Clicks "Log out". The app signs out, forgets the selected space, and goes to `/` (the Welcome page) (`:4132-4143`). No confirmation.
3. Presses the browser Back button. She expects the signed-out Welcome page; the app redirects any `/app` URL to `/sign-in` (`App.tsx:181`).
4. Signs in again with the same account; lands on `/app`.

##### Edge Cases
- Hide amounts is a browser setting, not an account setting; it stays on after log out for the next person on that browser (`lib/hide-amounts-preference.ts:30-34`).

### Stories: Onboarding steps and failures

#### STORY-APP-108: Maya's server has no model, so setup asks her to connect one

**Type**: medium
**Topic**: Onboarding, model step
**Persona**: Naive first-time founder on a self-hosted Praci
**Goal**: "Get through setup."
**Preconditions**: Fresh account; `me.needsModel=true`; model catalog lists several providers.
**Ideal path**: 4 — pick a provider, paste a key, press Continue. For a first-timer this step should not exist.
**Alternate paths**: Sign-in-based providers (a ChatGPT subscription) replace the key box with a sign-in button.

##### Steps
1. After sign-up she sees "Connect a model" with "Provider" (a dropdown), "Model", and an "API key" box (`pages/Onboarding.tsx:563-980`). **Hesitation:** she does not know what a provider or model is. Expects the product to bring its own.
2. Opens the provider dropdown. The first entry is preselected (`Onboarding.tsx:159-197`). She keeps it and sees the model dropdown fill in.
3. Sees "Thinking" (default "Medium") for some models. **Hesitation:** unexplained.
4. The "API key" box shows the hint `sk-…`. "Continue" is greyed out until a key is entered (`:254-260`). She has none. She looks for help; there is none on the page.
5. Pastes a MOCK key. A "Test API key" button appears for some providers (`components/ModelConnectionPreflightNotice.tsx:33-34`). She clicks it; it reads "Testing…" and then shows a success or failure notice.
6. Clicks "Continue". On success the page moves to the next step (server integrations if needed, otherwise the first bot). On failure a red line says "Could not save model" or the provider's reason (`:508`).

##### Variations
- Provider "OpenAI-compatible server": fields "Server URL", "Find models" ("Finding…"), a model list or "Other model…", and an "API key" disclosure whose box says "Optional" (`:596-690,950-975`). This is the only provider where a key is optional.
- Subscription sign-in providers: a sign-in button ("Sign in" or the provider's own label) opens a window; the page may ask her to paste "Authorization code or callback URL" and press "Submit" (`:819-884`).

##### Edge Cases
- The page remembers nothing if she reloads mid-way; the same page appears again.
- If the request for her account (`me`) fails, the page skips straight to creating Chief (`:197`) without a model check. If only the model list fails, the model step opens with an empty provider list and Continue stays off. (Code reading only.)

#### STORY-APP-109: Maya, the server owner, meets "Server integrations" during setup

**Type**: short
**Topic**: Onboarding, integrations step
**Persona**: Founder who is also the person who installed Praci
**Goal**: "Finish setup quickly; I will connect apps later."
**Preconditions**: Maya is the deployment owner; no app catalog is configured (`integrations.needsSetup=true`); a model is already configured.
**Ideal path**: 1 — Skip.
**Alternate paths**: Settings → Server integrations later (part B).

##### Steps
1. After sign-up she sees "Server integrations" and "Choose how apps connect for everyone on this server." (`components/integrations/IntegrationSetup.tsx:169-174`). Five rows follow: "Apps with their own server", "Popular apps through Composio", "Popular apps through Pipedream", "Google apps", "Your own tool server" (`:52-73`). **Hesitation:** every row is infrastructure vocabulary. She does not know that skipping is allowed.
2. Picks "Popular apps through Composio". Fields appear: "API key", "Get credentials", "Connect" (`:225-302`).
3. Presses "Skip" at the bottom (`:444`). She goes on to "Opening chat…" and Chief.

##### Variations
- "Continue" instead of Skip: it is disabled until credentials are filled in (`:427-441`).
- For someone who cannot configure the server, this step renders nothing at all, with no Skip button (`:164`). Whether the server ever sends such a user here (`needsSetup` for a non-owner) was not checked.

##### Edge Cases
- Failed load: "Could not load integrations" (`:104`).

#### STORY-APP-110: Maya ignores the focus card and just types

**Type**: short
**Topic**: Onboarding focus card
**Persona**: Impatient first-time founder
**Goal**: "Ask my question now."
**Preconditions**: Fresh Chief thread with the focus card showing.
**Ideal path**: 2 — type and send.
**Alternate paths**: Click X ("Dismiss").

##### Steps
1. Ignores the card. Types "Help me keep the cap table and investor updates straight" and presses Enter. Chief answers normally. The focus card remains pending above the conversation.
2. Scrolls up later and clicks "Inbox & email" on the old card. It still works: Chief posts a summary and connect cards below her last message (`onboarding.ts:244-260`). **Hesitation:** a choice made in the middle of an unrelated conversation looks like an interruption.
3. Alternatively clicks X ("Dismiss") in the corner. The card disappears and Chief posts nothing (`message-cards.tsx:45-56,76-93`; the server marks it dismissed, `onboarding.ts:218-241`).

##### Edge Cases
- The card does not reappear after a reload once dismissed or answered. If she sent a message before the card was posted, the server skips the card (`promptFocus` returns when a user message exists, `onboarding.ts:178-182`).

#### STORY-APP-111: A connect card fails when the popup is blocked or closed

**Type**: short
**Topic**: Onboarding, app connect cards
**Persona**: Naive first-time founder with a pop-up blocker
**Goal**: "Connect Gmail."
**Preconditions**: Chief's Gmail and Calendar cards are showing; the browser blocks pop-ups.
**Ideal path**: 2 — click Authorize, approve, see "Connected".
**Alternate paths**: Connect Gmail later in Integrations.

##### Steps
1. Clicks "Authorize" on Gmail. The button changes to "Waiting…" and is disabled (`message-cards.tsx:225-231`). The popup is blocked; nothing opens. The code does not check whether the popup opened (`:177-179`). **Hesitation:** nothing tells her to allow pop-ups.
2. She waits. The card polls every 2 seconds, up to 60 times (`:182-194`). After about 2 minutes: "Authorization timed out. Please try again." in red (`:195`). The button returns to "Authorize".
3. Allows pop-ups for the site and clicks "Authorize" again. Google asks for consent; she approves; the card shows "Connected" with a small pop animation.

##### Variations
- She closes the Google window without finishing: the same timeout path.
- A narrow card (phone) wraps the Authorize button under the name (`:213`).

##### Edge Cases
- Leaving the page cancels the wait (`useEffect` cleanup aborts, `:174`).
- Other failure: "Could not authorize this app" or the server's reason (`:197`).

#### STORY-APP-112: Maya's setup is interrupted and she reopens it

**Type**: medium
**Topic**: Onboarding, resilience
**Persona**: Naive first-time founder
**Goal**: "Pick up where I left off."
**Preconditions**: New account; network drops while the page shows "Opening chat…"; later she opens two tabs.
**Ideal path**: 2 — reload and land in the same Chief chat.
**Alternate paths**: "Try again" button.

##### Steps
1. Signs up. On "Opening chat…" the connection fails. The page shows a red message "Could not create your bot" and a "Try again" button (`pages/Onboarding.tsx:1034-1044`). She presses it; the same step runs again.
2. If the first attempt actually created Chief, the retry finds that bot by its spawn key and opens it instead of making a second one (`Onboarding.tsx:49-76,525-548`). She sees one Chief, not two.
3. She closes the tab, opens `/app` later. The shell finds her bot list and shows Chief with its greeting and the unanswered focus card.
4. She opens `/onboarding` in a second tab at the same time. A browser lock lets only one tab create Chief (`:78-83`); the other waits and reuses it.
5. If she later deletes every bot and group (nothing archived either, and no other space has content), `/app` sends her back to `/onboarding` and a new Chief is made (`Shell.tsx:1106-1119`).

##### Variations
- Creating a second space ("New space" in "+") leads to `/onboarding` again in that space, so the new space gets its own Chief (`Shell.tsx:5180-5190`).

##### Edge Cases
- The focus card is not posted twice: the server locks the thread and checks for an existing card (`onboarding.ts:175-196`).

### Stories: Paywall and subscription gate

#### STORY-APP-113: A teammate without billing rights hits the paywall

**Type**: short
**Topic**: Paywall, non-manager
**Persona**: Employee invited to a company workspace (Maya's cofounder Sam)
**Goal**: "Use the product my cofounder set up."
**Preconditions**: Billing enabled; the space has no active subscription; Sam cannot manage billing (`status.canManage=false`).
**Ideal path**: 1 — a message telling him whom to ask.
**Alternate paths**: none found.

##### Steps
1. Signs in. Sees the heading "Subscription required" (`pages/Paywall.tsx:47`). No price, no list of benefits, no subscribe button (`:63-81` render only for managers). The only control is "Log out".
2. **Hesitation:** nothing says that someone else must subscribe, or who. He expects at least "Ask your admin". He can only log out or wait.
3. When Maya subscribes, Sam switches back to the tab: the gate rechecks billing on focus and opens the app without a reload (`SubscriptionGate.tsx:61-81`).

##### Edge Cases
- Billing status lookup fails when Sam focuses the tab: ignored, he stays on the paywall (`:72`).

#### STORY-APP-114: Maya pays in another window and returns

**Type**: medium
**Topic**: Paywall, checkout round trip
**Persona**: Naive first-time founder
**Goal**: "Start the trial and keep going."
**Preconditions**: Same as STORY-APP-004. Variant A: web. Variant B: desktop app.
**Ideal path**: 3 — click, pay, return to find the app ready.
**Alternate paths**: Pay in the same tab (web).

##### Steps
1. Clicks "Start 14-day free trial". On the web the whole tab navigates to the billing page (`Paywall.tsx:28`).
2. On desktop the system browser opens and the Praci window stays on the paywall. The button is re-enabled after the call returns (`:31-34`). **Hesitation:** nothing says "finish in your browser"; she may click it again and open a second checkout.
3. Pays. Returns to the Praci window. When the window gets focus, the app asks the server again, and the paywall is replaced by the shell skeleton and then the app or onboarding (`SubscriptionGate.tsx:61-81`).
4. If payment is slow to register, nothing changes until the next focus event. She switches windows again and it opens.

##### Edge Cases
- She keeps the paywall open for hours: the gate only rechecks on focus or tab visibility, not on a timer.

#### STORY-APP-115: A lapsed subscriber needs the billing portal

**Type**: short
**Topic**: Paywall, past due
**Persona**: Returning founder whose card failed
**Goal**: "Fix my payment."
**Preconditions**: Customer exists; state is "past_due", "incomplete" or "canceled"; Maya can manage billing.
**Ideal path**: 2 — "Manage billing", update the card.
**Alternate paths**: "Subscribe".

##### Steps
1. Signs in and sees the paywall with the price heading, benefits, a primary button ("Subscribe", or the trial button if the server still offers a trial) and below it a second, lighter button "Manage billing" (`Paywall.tsx:73-93`, `showPortal` at `:17-20`).
2. Clicks "Manage billing". The billing portal opens. She updates the card.
3. Returns; the window focus recheck opens the app. **Hesitation:** two buttons, "Subscribe" and "Manage billing", look like alternatives. She is unsure which one fixes a failed card.

##### Edge Cases
- Portal fails to open: "Could not open billing".

### Stories: Sidebar and navigation

#### STORY-APP-005: Maya orients herself in the sidebar

**Type**: medium
**Topic**: Navigation
**Persona**: Naive first-time founder
**Goal**: "Figure out where email, money, equity and documents live, and what everything else is."
**Preconditions**: Full shared seed (Chief, two helpers, Leadership group, MOCK Ops section, one archived bot, 3 unread mails, 6 artifacts).
**Ideal path**: 1 — one glance at a labeled sidebar.
**Alternate paths**: Cmd+K lists pages, bots and groups (STORY-APP-008); the search box finds pages by name (STORY-APP-007).

##### Steps
1. Reads the top row of the sidebar: a bell (tooltip "Activity"), a panel icon (tooltip "Hide sidebar", desktop only) and a plain "+" (tooltip "Create") (`pages/Shell.tsx:3354-3395`). **Hesitation:** she expects the bell to list notifications; it opens a list of runs (STORY-APP-124). The "+" has no label until she hovers.
2. Reads the search box, "Search chats", with a magnifier (`:3455`). Below it come five links with icons: Inbox (badge "3" when there are unread messages), Finance, Cap table, Data room, Artifacts (`:3471-3531`). She clicks each; the main area changes and the link is highlighted. **Hesitation:** "Data room" and "Artifacts" both hold files. The icons differ now (folder vs stacked files, `:3519-3524`) but the names do not say how.
3. Below the links is the bot list: rows with a colored avatar, name, time and a one-line preview, and a dot when unread (`:3740-3960`). "MOCK Ops" is a heading she can click to collapse (`:3580-3640`); the Leadership group is a row with stacked avatars, listed with the bots. Clicks Chief; the chat opens at `/app/<id>`.
4. Hovers a bot row. A "..." button appears at the right (`:3944`) and the time hides. Right-click opens the same menu. **Hesitation:** on a touch screen that button is hidden (`pointer-coarse:hidden`), so a phone user has no visible way to the menu.
5. Scrolls to "Archived 1" (`:3980`) and expands it: "MOCK Old intern bot" with "Restore" and "Delete".
6. At the bottom, reads "Integrations" and then her initials and name (`:4058-4080`). Clicks the name: menu with Settings, Hide amounts, Usage, Log out ("Task board" appears only if enabled) (`:4084-4146`). **Hesitation:** Settings is not a sidebar link, and Artifacts is no longer in this menu (it moved to the sidebar).

##### Variations
- Density "Compact" (Settings) shortens rows and swaps previews for a status word.
- On a phone every part of this lives in a drawer (STORY-APP-121).

##### Edge Cases
- No bots, groups or archive in the space: she is sent to onboarding (STORY-APP-112). Bots exist but none is selected: the header reads "Select a bot" (`:4267`).
- Only one space exists: no space name is shown; the first section has no heading (`pages/shell/space-sidebar.ts:50-66`).

#### STORY-APP-006: Maya looks for the investor update Chief made last week

**Type**: short
**Topic**: Navigation to Artifacts
**Persona**: Naive first-time founder
**Goal**: "Find the document Chief wrote for me."
**Preconditions**: Artifact "Q3 investor update draft" exists; Data room holds 3 other MOCK documents.
**Ideal path**: 2 — open the documents area and click the file.
**Alternate paths**: Scroll Chief's thread to the file card (STORY-APP-133); type "investor" in the sidebar search; Cmd+K then "Artifacts".

##### Steps
1. Clicks "Data room" because it sounds like documents. Sees her 3 uploaded documents, not Chief's draft. **Hesitation:** nothing there says where Chief's files live.
2. Sees "Artifacts" one line lower in the sidebar and clicks it. The page "Artifacts" opens inside the same shell (`/app/artifacts`, `App.tsx:188`) with cards in a grid.
3. Clicks the "Q3 investor update draft" card. The URL becomes `/app/artifacts/<id>`; a list of artifacts is on the left and the document on the right (STORY-APP-130).

##### Variations
- Types "investor" in the sidebar search: Data room documents are listed, but artifacts are not searched there; only chats, pages and documents (STORY-APP-119). The word "Artifacts" matches the page named Artifacts, not the file.
- Cmd+K, "Arti" shows the Artifacts page under "Pages" (`pages/Shell.tsx:1788-1799`).

##### Edge Cases
- Artifact page empty: "No artifacts found." (STORY-APP-132).

#### STORY-APP-007: Maya searches the sidebar for "SAFE"

**Type**: short
**Topic**: Sidebar search
**Persona**: Naive first-time founder
**Goal**: "Find where we talked about the SAFE."
**Preconditions**: Chief message containing "MOCK DEMO DATA SAFE discount 20%"; Data room document "Seed SAFE.pdf".
**Ideal path**: 2 — type, click a result.
**Alternate paths**: Cmd+K searches names only (STORY-APP-008); Inbox has its own box.

##### Steps
1. Types "SAFE" into "Search chats" (`pages/Shell.tsx:3455`). **Hesitation:** the placeholder says chats, but the results include documents and mail.
2. After about 200 ms (`:1822-1857`) the bot list is replaced by grouped results (`pages/SpaceSearch.tsx:95-163`): "Documents" (the Seed SAFE.pdf), "Mail" ("Search mail for “SAFE”"), and "Chats" (the matching message with the bot name and a snippet). Pages appear first when a page name matches.
3. Clicks the chat hit. The app opens that bot at `?m=<messageId>` and scrolls to the message (`jumpToSearchHit`, `:1859-1869`). The box clears.
4. Pressing Escape in the box, or the X ("Clear search"), clears it and brings the bot list back (`:3447-3470`).

##### Variations
- Clicks the document: opens Data room with that item selected (`/app/data-room?item=<id>`).
- Clicks "Search mail for “SAFE”": opens the Inbox with `?q=SAFE`.

##### Edge Cases
- Nothing matches: only the "Mail" row remains. The text "No results" never appears in the sidebar, because the mail row is always supplied (`SpaceSearch.tsx:80`, `Shell.tsx` passes `onSearchMail` always). See Suspected problems.
- Slow search: "Searching…" shows inside the Chats section while the request runs.

#### STORY-APP-008: Maya presses Cmd+K to go to Finance

**Type**: short
**Topic**: Command palette
**Persona**: Founder who uses Notion/Linear and tries Cmd+K by habit
**Goal**: "Jump to Finance, or to the Finance helper, from the keyboard."
**Preconditions**: Chief, MOCK Finance helper, MOCK Hiring helper, Leadership group exist.
**Ideal path**: 2 — Cmd+K, type "fin", Enter.
**Alternate paths**: Sidebar link; Cmd+1 to Cmd+9 for the first nine bots.

##### Steps
1. Presses Cmd+K (Ctrl+K on Windows and Linux) (`pages/shell/command-palette-hotkey.ts`, listener `pages/Shell.tsx:2966-2973`). A dialog opens with an input "Search" and a list. Nothing on screen taught her this shortcut. **Hesitation:** none visible before she tries.
2. Sees the list in one order: "Bots" (each with avatar, name, optional title badge, a subtitle and its shortcut such as "⌘1"), then "Groups", then "Pages" (Inbox, Finance, Cap table, Data room, Integrations, Artifacts, Settings) (`pages/shell/command-palette.tsx:104-205`). The "Bots" heading shows only when groups or pages are also listed.
3. Types "fin". The list shows "MOCK Finance helper" under Bots and "Finance" under Pages (`:62-66`). Arrow keys move; Enter on "Finance" opens the Finance page. Enter on the helper opens that bot's chat.
4. Opens again, presses Cmd+2. The second bot in the full list opens at once, even if the list is filtered (`:68-83`).

##### Variations
- Types "cap" → "Cap table" page. Types "settings" → "Settings", which opens the settings dialog, not a page (`Shell.tsx:1814-1819`).
- Presses Cmd+K again: the palette closes (it toggles) (`:2970`).

##### Edge Cases
- Typing text that matches nothing shows "No results".
- Inside the email composer, Cmd+K inserts a link and does not open the palette (`components/compose/RichTextEditor.tsx:70-75`). Inside the chat box it opens the palette.

#### STORY-APP-009: Maya hides the sidebar, then uses Praci on her phone

**Type**: short
**Topic**: Hide and show the sidebar
**Persona**: Founder between meetings
**Goal**: "More room for the chat; later, check Chief from my phone."
**Preconditions**: Shared seed.
**Ideal path**: 2 per device.
**Alternate paths**: Drag the sidebar's right edge (STORY-APP-122); phone details in STORY-APP-121.

##### Steps
1. On a laptop, clicks the panel icon at the top right of the sidebar ("Hide sidebar") (`pages/Shell.tsx:3376-3385`). The sidebar slides away. Her choice is saved for her account on this browser (`setBotsSidebarCollapsedPref`, `:2735-2738`).
2. Finds the panel-open icon ("Show sidebar") at the left of the chat header (`:4229-4238`) and clicks it. The sidebar returns. **Hesitation:** labels now say "sidebar", not "bots", which fixes the old mismatch with Inbox and Finance being inside.
3. At 390 px width the sidebar is a drawer. The header shows a menu icon ("Open navigation") (`:4220-4228`). She taps it, taps Inbox; the drawer closes (`:3472-3482`).
4. Taps the dark strip right of the drawer ("Close navigation", `:3335`) to close it without choosing.

##### Edge Cases
- Reloading keeps the hidden state. A different user on the same browser has their own state.
- When the window grows past 768 px with the drawer open, the drawer state resets (`:695-702`).

### Stories: Sidebar details

#### STORY-APP-116: Maya reorders her bots and tames a long sidebar

**Type**: medium
**Topic**: Sidebar ordering and sections
**Persona**: Naive first-time founder with 8 bots
**Goal**: "Put Chief first and the Finance helper under it."
**Preconditions**: 8 MOCK bots; section "MOCK Ops"; one bot has child bots (a bot that created sub-bots).
**Ideal path**: 2 — drag a row up.
**Alternate paths**: Alt+Up/Alt+Down on a focused row; "Pin" and "Move to" in the row menu (part B, STORY-APP-010).

##### Steps
1. Drags "MOCK Finance helper" above "MOCK Hiring helper". The row dims while dragging (`pages/Shell.tsx:3759-3800`). On drop the new order is applied at once and saved (`reorderRosterBot`, `:1753-1766`).
2. Tries to drag a bot into the "MOCK Ops" section. The drop is ignored; drags only work among rows with the same parent and in the same group (`:3770-3795`). She finds "Move to" in the row menu instead. **Hesitation:** the drag handle gives no hint of what is allowed.
3. Clicks the heading "MOCK Ops". The section collapses; the chevron turns and the state is saved per user (`:3590-3600`, `toggleSidebarSection`). Aria label: "Collapse MOCK Ops".
4. Sees a small chevron beside a bot with children. Clicks it ("Collapse {name}"). The children hide; indentation shows the tree (`:3730-3755`).
5. Focuses a row with Tab and presses Alt+ArrowDown. The row moves one place down among its siblings (`:3795-3812`). The row declares `aria-keyshortcuts` for it.

##### Variations
- Failure to save the order silently rolls back when nothing newer is queued (`:1728-1750`); the row jumps back with no message.

##### Edge Cases
- Archived bots, and group rows, cannot be dragged (only bots are draggable, `:3759`).
- Right-click on the "MOCK Ops" heading offers "Rename section" (`:3600-3620`).

#### STORY-APP-117: Maya has two spaces and the sidebar changes shape

**Type**: medium
**Topic**: Sidebar with several spaces
**Persona**: Naive first-time founder
**Goal**: "Keep my side project away from Northwind."
**Preconditions**: A second space "Side project" with one bot; the user is in the first space.
**Ideal path**: 2 — click a bot in the other space.
**Alternate paths**: none found.

##### Steps
1. Sees space names as small upper-case headings with a lock icon, such as "NORTHWIND ROBOTICS · MOCK OPS" for a section, and a separate heading for the second space (`pages/shell/space-sidebar.ts:50-66`, `Shell.tsx:3580-3640`). With only one space, none of this shows. **Hesitation:** the space heading doubles as a collapse button, and the section text is joined to the space name with "·", which gets long.
2. Clicks a bot in the Side project space. If it is another space, the whole page reloads at that bot's URL so every request carries the right space (`openSpaceChat`, `:1710-1725`). She sees a brief skeleton ("Opening your Space…").
3. Clicks "Actions for Northwind Robotics" (the "..." button at the heading) to rename or delete the space (`:3665-3690`).
4. An empty space shows only its heading. Clicking it opens that space's onboarding (`group.emptySpaceId`, `:3590-3595`).

##### Edge Cases
- While searching, spaces with no matching rows disappear (`space-sidebar.ts:82`).
- Right-click on a space heading opens the space menu; on a section heading it opens the section menu.

#### STORY-APP-118: Maya looks for "Add page" in the sidebar

**Type**: short
**Topic**: Sidebar Add page row (dormant)
**Persona**: Naive first-time founder who has heard "you can add pages"
**Goal**: "Add a team health page."
**Preconditions**: Production build as of this commit.
**Ideal path**: 2 — click "Add page" and choose "Team health". The row does not appear.
**Alternate paths**: none found.

##### Steps
1. Looks between "Artifacts" and the bot list. Nothing is there. The component `SidebarPages` is rendered (`pages/Shell.tsx:3532`) but shows no "Add page" row, because its only template, "Team health", is marked `available: false` (`packages/contracts/src/sidebar-pages.ts:4-11`), so the list is never loaded (`components/SidebarPages.tsx:38-41`) and `AddSidebarPage` renders nothing when it has no choices (`AddSidebarPage.tsx:25`).
2. If a template were available, the row would show a plus, "Add page", and a menu with the page name and a one-line description. Added pages would appear as links with a "Page options" menu and "Remove from sidebar" (`SidebarPages.tsx:91-116`).
3. Types `/app/team-health` in the address bar. The route `/app/:botId` takes "team-health" as a bot id, finds nothing, and moves her to the first bot (`Shell.tsx:1130-1133`).

##### Edge Cases
- This story records an absence. When a template ships, the dependent stories are: add page, remove page (with redirect to `/app` if it is open), owner-only restriction, and desktop-only restriction.

#### STORY-APP-119: Maya uses sidebar search to reach a page, a document and mail

**Type**: medium
**Topic**: Sidebar search, result types
**Persona**: Naive first-time founder
**Goal**: "Get to the Seed SAFE file without remembering where it lives."
**Preconditions**: Shared seed; mail with "SAFE" in the subject.
**Ideal path**: 2 — type, click.
**Alternate paths**: Data room's own search; Inbox's own search.

##### Steps
1. Types "cap". The "Pages" section lists "Cap table" (`pages/Shell.tsx:1801-1806`, `SpaceSearch.tsx:97-102`). Clicks it; the box clears and the page opens (`openAppPage`).
2. Types "settings". "Pages" lists "Settings". Clicking it opens the Settings dialog (not a page), and the search box clears (`:1814-1819`).
3. Types "SAFE". "Documents" lists up to 5 Data room files by name or content (`:1830-1840`). She clicks one; Data room opens with it selected.
4. Clicks "Search mail for “SAFE”". The Inbox opens filtered by the text. **Hesitation:** the Mail row is always shown, even when she is not looking for mail.
5. Dollar amounts in labels are hidden when "Hide amounts" is on (`SpaceSearch.tsx:22-34`).

##### Variations
- A failure of the document request hides only the Documents section (`:1836-1838`).
- Types a bot's name: bots have no results section of their own. The bot list is hidden while the box has text (`:3532-3552`), so she reaches a bot only through a "Chat" hit, which shows the bot name beside the snippet.

##### Edge Cases
- Pressing Escape clears the box only when it has text (`:3445-3450`).

#### STORY-APP-120: Maya uses the palette for groups, pages and numbered bots

**Type**: medium
**Topic**: Command palette depth
**Persona**: Founder who learned Cmd+K and wants speed
**Goal**: "Reach the Leadership group and Integrations in seconds, without the mouse."
**Preconditions**: Shared seed; 3 bots; 1 group. Windows laptop for the variation.
**Ideal path**: 2 per target.
**Alternate paths**: Sidebar clicks.

##### Steps
1. Presses Ctrl+K. The dialog opens. Bots are listed with Ctrl1, Ctrl2, Ctrl3 on the right; the group and pages have no shortcut (`command-palette.tsx:60-62,140-155`).
2. Types "lead". The Leadership group appears under "Groups" with its avatar stack. Presses Down and Enter. The group chat opens at `/app/g/<id>` and the sidebar drawer closes if it was open (`Shell.tsx:5162-5180`).
3. Opens the palette, types "integ". Enter on "Integrations" under "Pages" opens that page.
4. With the palette open, presses Ctrl+2. The second bot opens even if the list is showing different rows (`:68-83`). **Hesitation:** the numbers follow the unfiltered bot order, so "Ctrl2" may point to a different bot than the second row she sees.
5. Presses Escape to close. The dialog title for screen readers is "Go to" with the description "Search pages, bots and groups".

##### Variations
- Mac: shows "⌘1". The modifier is detected from the browser platform (`:25-30`).
- On a phone there is no hardware keyboard; the palette cannot be opened (no on-screen button). She uses the drawer instead.

##### Edge Cases
- Archived bots and the Settings subsections (Models, Usage) are not listed.
- The palette stays above the chat box; a draft message in the box is kept.

#### STORY-APP-121: Maya opens the drawer on her phone and swipes

**Type**: medium
**Topic**: Phone drawer
**Persona**: Founder on a 390 px phone
**Goal**: "Switch from Chief to Inbox with my thumb."
**Preconditions**: Shared seed; phone width; touch input.
**Ideal path**: 2 — menu icon, Inbox.
**Alternate paths**: Swipe right from the left edge.

##### Steps
1. Opens `/app`. No sidebar is visible. The header shows a menu icon ("Open navigation") and Chief's name (`pages/Shell.tsx:4220-4228`). The "Hide sidebar" icon is absent on a phone (`hidden md:inline-flex`, `:3378`).
2. Taps the menu icon. The sidebar slides in, 316 px at most and 48 px narrower than the screen, with a dark strip on the right (`:3335-3340`). The chat behind it is inert and hidden from screen readers (`:4195-4199`).
3. Taps Inbox. The drawer closes and Inbox loads (`:3472-3482`).
4. Back on Chief, puts a finger within 32 px of the left edge and swipes right by at least 56 px, moving more sideways than up or down (`:3282-3321`, constants at `:380-381`). The drawer opens. **Hesitation:** nothing hints at the swipe.
5. Taps the dark strip to close ("Close navigation").

##### Variations
- Left-to-right languages only; in right-to-left languages the swipe starts at the right edge (`:3290-3295`).
- Opening a bot, group, search result or Activity run from the drawer also closes it.

##### Edge Cases
- The row "..." menu button is hidden on touch (`pointer-coarse:hidden`, `:3956`); long-press (browser context menu event) is the only path. On iOS Safari this may not fire. Unverified in a real browser.
- Rotating to landscape wider than 768 px resets the drawer (`:695-702`).

#### STORY-APP-122: Maya drags the sidebar edge and uses the keyboard to show it again

**Type**: short
**Topic**: Sidebar edge handle
**Persona**: Founder with a mouse
**Goal**: "Collapse the sidebar quickly."
**Preconditions**: Desktop width; sidebar open.
**Ideal path**: 1 — click or drag the thin line at the sidebar's right edge.
**Alternate paths**: Panel icon (STORY-APP-009).

##### Steps
1. Moves the pointer to the right border of the sidebar (an invisible 8 px strip with a resize cursor, `pages/Shell.tsx:4150-4190`). Drags left. After a short distance the sidebar hides. A click without movement toggles it too. **Hesitation:** the strip has no visible handle; she finds it by accident.
2. The collapsed sidebar is `inert`: nothing in it can be focused (`:3344`). The same edge now sits at the window's left edge. Dragging right shows it.
3. Tabs to the edge control: it is a button named "Show sidebar" or "Hide sidebar" with a pressed state, so keyboard users can toggle it with Enter or Space.

##### Edge Cases
- Hidden while the full-screen computer view is open (`computerOpen || booting`), so the edge never steals clicks there (`:4150`).

#### STORY-APP-123: Maya moves around with only the keyboard

**Type**: medium
**Topic**: Keyboard navigation
**Persona**: Founder who dislikes the mouse
**Goal**: "Open Inbox, then Chief, then search for 'runway', without the mouse."
**Preconditions**: Shared seed; desktop width.
**Ideal path**: 6.
**Alternate paths**: Palette only (STORY-APP-120).

##### Steps
1. Tabs through the sidebar top row: Activity, Hide sidebar, Create (+), the search box, then Inbox, Finance, Cap table, Data room, Artifacts as buttons, then the bot rows (`Shell.tsx:3354-3531`).
2. Presses Enter on Inbox. The page opens. Focus stays on the link.
3. Presses Cmd+K, types "chief", presses Enter. Chief opens.
4. Presses Tab until the search box, types "runway", reads the results with Tab and Enter. Escape clears.
5. On a bot row, presses Alt+ArrowUp to move it (`:3795-3812`).
6. Opens the "..." row menu with Tab then Enter (button is visible on keyboard focus, `:3956`) and closes it with Escape; focus returns to the row (`:716-722`).
7. **Hesitation:** no skip link; she tabs through about 15 controls to reach the chat box.

##### Edge Cases
- The collapsed sidebar is skipped by Tab (`inert`).

### Stories: Notifications and Activity

#### STORY-APP-124: Maya clicks the bell and finds a list of runs, not notifications

**Type**: medium
**Topic**: Activity list
**Persona**: Naive first-time founder
**Goal**: "See what needs me and what finished."
**Preconditions**: Activity seed: 1 running run (Finance helper), 1 "Needs input" run (Chief), 4 finished runs.
**Ideal path**: 2 — click the bell, click the row that needs her.
**Alternate paths**: Open each bot in turn.

##### Steps
1. Hovers the bell: tooltip "Activity" (`pages/Shell.tsx:3354-3376`). Clicks it. The bell turns solid (dark circle) and an "Activity" block appears above the bot list; the bot list is still there beneath it. She expected a drop-down of notifications. **Hesitation:** the earlier catalog said the bot list was replaced; the code now puts the Activity block above it (`:3552-3560`).
2. Sees the block with sections that only show when they have rows: "Needs you" (Chief, "Needs input"), "Working" (Finance helper, "Running"), "Finished" (the four done runs) (`pages/ActivityList.tsx:164-178`). Each row has a colored dot, the bot name (with " · group name" if it ran in a group), a time like "5m ago", a snippet of the request and a status word (`:392-420`). Amber is for waiting, red for failed, green for done.
3. Clicks the "Needs input" row. The app opens Chief's chat (or the group's chat) and the drawer closes on a phone (`Shell.tsx:3553-3560`). The answer to Chief's question is waiting there.
4. The list refreshes itself every 15 seconds (`ActivityList.tsx:57-58`). The mode stays on after a reload (`lib/activity-mode.ts`).
5. Clicks the bell again. The block disappears; only the bot list remains.

##### Variations
- Status words: Queued, Starting, Running, Needs input, Needs takeover, Done, Failed, Cancelled (`:430-450`).
- Run in a group: the title reads "MOCK Finance helper · Leadership".

##### Edge Cases
- The load fails: an alert with the reason and "Try again" (`:235-240`).
- A run on a bot the user archived still appears.

#### STORY-APP-125: Maya filters the Activity list and meets its empty states

**Type**: short
**Topic**: Activity list, filters and empty states
**Persona**: Founder with many runs
**Goal**: "Find the failed run from Tuesday."
**Preconditions**: Activity mode on; 30 MOCK runs of mixed status.
**Ideal path**: 3 — Filter, Status = Failed, click row.
**Alternate paths**: Type in "Search runs".

##### Steps
1. Clicks "Filter" at the right of the block (`ActivityList.tsx:136-148`). A form opens: "Search runs", "Status" (All statuses, and each status), "From" and "To" dates (`:255-325`).
2. Chooses Status "Failed". The list narrows and a chip appears: for example "Search: refund" or "From 2026-10-13" with a clear (x) button each; "Reset all" clears every filter (`:335-372`).
3. Picks a date range that matches nothing. The text "No runs match these filters." shows (`:158-162`).
4. With no runs at all and no filters, the whole block reduces to one line, "Nothing needs you right now." with a bottom rule (`:112-122`). **Hesitation:** "Nothing needs you" reads as a verdict, even though recent finished runs may exist once the first run happens; with zero history it is accurate.

##### Edge Cases
- Filters reset when she turns Activity off and on (state is local to the block).
- While loading the first time: "Loading activity…".

#### STORY-APP-126: Maya switches tabs while Chief works and gets a browser notification

**Type**: medium
**Topic**: Browser notifications
**Persona**: Naive first-time founder
**Goal**: "Tell me when Chief is done so I can do something else."
**Preconditions**: Notification permission "default"; Chief has "Notifications" on (default for new bots, `Shell.tsx:2752`); desktop browser.
**Ideal path**: 2 — allow once, get a notification.
**Alternate paths**: Per-bot "Notifications" switch in bot Settings (part B).

##### Steps
1. Sends Chief a long request ("Draft a 6-month cash forecast"). At that moment the browser asks "Show notifications?" (`Shell.tsx:2350-2356`, `lib/browser-notifications.ts:15-35`). **Hesitation:** the prompt appears without any in-app explanation, right as she presses Enter. She allows it.
2. Switches to another tab. When Chief posts a reply, a system notification shows with the bot's name as title and the reply text (Markdown removed; currency masked if "Hide amounts" is on) as the body (`browser-notifications.ts:71-105`).
3. The same applies when a run fails ("Chief failed", "Failed.") or is cancelled ("Chief stopped", "Stopped.") (`:47-61,106-123`).
4. Comes back and clicks the notification. The code attaches no click handler (`Shell.tsx:1016`), so what the click does (focus the tab or not) depends on the browser.
5. While the tab is visible and the window focused, no notification is sent; she sees the reply in the chat (`browser-notifications.ts:64-68`).

##### Variations
- Group chats always notify, regardless of the per-bot switch (`Shell.tsx:1011`, `groupNotification`).
- If permission is still "default" when a reply lands, the notification waits and is sent after she answers the prompt (`:1056-1066`).

##### Edge Cases
- Only the bot or group she is looking at is watched. The notification stream is tied to the open chat (`Shell.tsx:1521,1652`, `shouldNotifyBrowser` checks the thread). If she leaves Chief for Finance or Inbox (which open their own agents) she hears nothing about Chief. A "Needs input" prompt is not a notification event at all; only bot messages, failures and cancellations are. See Suspected problems.
- No in-app unread count outside the sidebar dot and the Inbox badge; no sound; the tab title does not change.

#### STORY-APP-127: Maya blocked notifications and later wants them

**Type**: short
**Topic**: Browser notifications, denied
**Persona**: Naive first-time founder
**Goal**: "Turn alerts on again."
**Preconditions**: Browser permission "denied" (she clicked Block earlier).
**Ideal path**: 3 — find a setting that explains how.
**Alternate paths**: Browser's site settings.

##### Steps
1. Sends a message. No prompt appears; the app sees "denied" and does nothing (`Shell.tsx:1056`).
2. Switches tabs; Chief answers; nothing happens.
3. Looks in Settings for a notifications section. None exists: Settings lists General, Models, Memory, Voice, Usage, Computer, Billing, Updates (`pages/SettingsOverlay.tsx:137-150`). Bot Settings has a "Notifications" switch, but turning it on does not change the browser block. **Hesitation:** the switch says on while the browser says no; nothing explains.
4. Must open the browser's lock icon and allow notifications for the site.

##### Edge Cases
- On a phone browser notifications are generally unavailable; the app silently skips (`typeof Notification === "undefined"`, `Shell.tsx:1056`).

### Stories: Hide amounts

#### STORY-APP-128: Maya hides amounts before sharing her screen

**Type**: medium
**Topic**: Hide amounts toggle
**Persona**: Founder presenting to a new hire
**Goal**: "Show the product without showing our cash."
**Preconditions**: Finance with MOCK balances; Cap table with MOCK holdings; a Chief message with "$412,300 runway cash"; Activity and sidebar previews contain currency amounts.
**Ideal path**: 2 — click Hide amounts once.
**Alternate paths**: Header eye button on Finance and Cap table; account menu row anywhere.

##### Steps
1. Opens Finance. Next to the title "Finance" (and the space name) is an eye icon (`components/finance/ui.tsx:232`, `pages/Finance.tsx:378`). Hovers: tooltip "Hide amounts. Hides amounts on finance screens and masks currency amounts in chat text. Plain numbers in agent replies may still show." (`components/HideAmountsToggle.tsx:7-8,24-30`).
2. Clicks it. Amounts on the page are masked; the icon changes to an eye-off and the tooltip becomes "Show amounts" (`:13-22`). Charts show "Chart hidden while amounts are hidden" instead of a plot (`pages/shell/message-cards.tsx:238-249`).
3. Goes to Cap table. The same eye button is in its header (`pages/CapTable.tsx:589`); it is already on.
4. Goes to Chief. Currency amounts in messages are masked, and so are sidebar previews, search results and notification bodies (`Shell.tsx:3715-3720`, `SpaceSearch.tsx:22-34`, `browser-notifications.ts:85`). Plain numbers without a currency sign (such as "412300") may still show, as the tooltip warns.
5. On Inbox or Data room there is no eye button in the page header. She opens the account menu (initials at the bottom) and finds a row "Hide amounts" with the same helper text underneath (`HideAmountsToggle.tsx:38-62`, `Shell.tsx:4118`). The menu closes after she clicks.
6. Reloads. The setting persists in this browser (`lib/hide-amounts-preference.ts:7,16-24`). **Hesitation:** it is a browser setting, not an account setting. On a second computer amounts show again.

##### Variations
- Turn off: the same control now reads "Show amounts".

##### Edge Cases
- Storage blocked: the choice applies only until reload (`:26-34`).
- No masking code was found for file names ("Q3 burn $412k.pdf") or for the content of HTML artifacts and PDFs. Treat those as visible.

### Stories: Artifacts

#### STORY-APP-129: Maya browses Artifacts and filters the list

**Type**: medium
**Topic**: Artifacts list
**Persona**: Naive first-time founder
**Goal**: "See every file my assistants made and find the board deck."
**Preconditions**: 6 MOCK artifacts from two bots (Chief and the Finance helper).
**Ideal path**: 2 — open Artifacts, click the card.
**Alternate paths**: Search box in the sidebar does not search artifacts.

##### Steps
1. Clicks "Artifacts" in the sidebar. The page title "Artifacts" appears with a "Filters" button and a pair of view buttons, "Card view" and "List view" (`pages/Artifacts.tsx:210-262`). Cards are in a grid: file icon, the name, up to two lines of description, a short file-type badge, and "v3" when there are several versions, the bot's avatar and name, and a relative time (`:621-688`).
2. Clicks "List view". Rows replace cards; her choice is remembered (`localStorage rakazo:artifacts-view-mode`, `:46-65`).
3. Clicks "Filters". A search box "Search artifacts…", a date menu ("All time", "Today", "This week", "This month") and chips "All bots" plus one per bot appear (`:262-290`). Types "board" in the search box; the list narrows. Clicks the "MOCK Finance helper" chip; the list reloads for that bot only (`:111-128`).
4. Clicks the card "Board deck.pdf". It opens (STORY-APP-130).

##### Variations
- A list of more than 60: "Load more" at the bottom fetches the next page (`:130-153,436-444`). A filter that finds nothing on loaded pages keeps loading pages automatically (`:175-186`).
- Phone: the grid becomes one column; the filter chips wrap.

##### Edge Cases
- The date filter and search only see loaded pages; with a next page waiting and no match the message is "No matching artifacts on this page." with a "Load more" button (`:455-478`).
- Bot filter chips list all bots, including ones that have never made a file.

#### STORY-APP-130: Maya opens an artifact, switches versions and downloads it

**Type**: medium
**Topic**: Artifact preview
**Persona**: Naive first-time founder
**Goal**: "Read the investor update, compare with the older draft, and send it to my accountant."
**Preconditions**: "Q3 investor update draft" with 3 versions (Markdown). A PDF and an HTML artifact exist.
**Ideal path**: 3 — open, read, Download.
**Alternate paths**: Download from the chat file card (STORY-APP-133).

##### Steps
1. Clicks the card. The URL becomes `/app/artifacts/<id>`. The list shrinks to a narrow column at the left (320 px) and the document opens at the right (`pages/Artifacts.tsx:296-320`). The Filters button stays; the view toggle disappears while a file is open.
2. The document header shows the name, description, a "Version" menu ("v3 · 2d ago", "v2 · 5d ago", "v1 · 9d ago"), "Download" and a maximize square (`:776-880`). Markdown renders as a reading column.
3. Selects "v2". The page reloads that version (`:790-815`).
4. Clicks "Maximize" (tooltip). The list hides; the label becomes "Show list". Clicks it again to return.
5. Clicks "Download". The browser saves `Q3 investor update draft` with the original type (`lib/artifact-open.ts:25-32`). No extension is added to the name if the artifact name lacks one. **Hesitation:** on Windows, a file with no extension opens in the wrong app.
6. Opens the HTML artifact. A dark pill at the bottom right reads "Isolated preview — no access to your account" (`:905-918`), and the page runs in a sandbox (`components/SandboxedHtmlViewer.tsx`).

##### Variations
- PDF: shown in the PDF viewer. Images: centered, scaled. Other types: "Preview isn't available for this file type — download it to view it." (`:945-949`).
- Phone width: see Suspected problems (the 320 px list column).

##### Edge Cases
- The file fails to load: red box "Could not load this artifact." (`:830-836`).
- The versions list fails: the page still opens the newest version silently.
- Deleted by someone else while open: the load error appears.

#### STORY-APP-131: Maya deletes an old artifact

**Type**: short
**Topic**: Artifact delete
**Persona**: Naive first-time founder
**Goal**: "Remove the draft I do not want."
**Preconditions**: Artifact with 3 versions; mouse.
**Ideal path**: 2 — trash icon, confirm.
**Alternate paths**: none found.

##### Steps
1. Hovers a card or row. A small trash icon fades in at the bottom right of the card or at the right of the row ("Delete {name}") (`pages/Artifacts.tsx:670-686,738-744`). It also shows when the card has keyboard focus.
2. Clicks it. A dialog: "Delete "Q3 investor update draft"?" and "This deletes all 3 versions of this artifact. This can't be undone." For a one-version file: "This can't be undone." Buttons "Cancel" and "Delete" (`:329-370`). **Hesitation:** deletion removes every version, not only the one on screen.
3. Clicks "Delete". The button reads "Deleting…". On success the card disappears; if that artifact was open, the page returns to `/app/artifacts` (`:191-206`).

##### Edge Cases
- Failure: red text in the dialog, "Could not delete this artifact." or the server reason; the dialog stays open (`:198-202`).
- While deleting, Cancel and Escape are disabled (`:353-358`).
- On a touch screen there is no hover; the icon is invisible until focused (no touch rule in `:681,740`). See Suspected problems.

#### STORY-APP-132: The Artifacts page is empty, slow or broken

**Type**: short
**Topic**: Artifacts states
**Persona**: New founder, day 1
**Goal**: "Check if the assistant made anything yet."
**Preconditions**: A new space with no artifacts; later, a failing network.
**Ideal path**: 1 — a clear empty message.
**Alternate paths**: none found.

##### Steps
1. Opens Artifacts. "Loading…" shows in the middle, then "No artifacts found." (`pages/Artifacts.tsx:371-385,455-462`). **Hesitation:** nothing says what an artifact is or how to get one ("ask Chief to write a document"). She leaves the page.
2. With the network cut, the middle shows the error text "Could not load artifacts." instead of Loading (`:122,371-380`). There is no Retry button; she reloads the page or picks a bot chip, which triggers a new request.
3. Applies a bot chip that has no files: "No artifacts found."

##### Edge Cases
- "Load more" failing is silent; the button just becomes active again (`:143-147`).

#### STORY-APP-133: Maya previews and downloads a file from Chief's chat

**Type**: medium
**Topic**: Chat file card
**Persona**: Naive first-time founder
**Goal**: "Read the term sheet summary Chief just wrote, and keep a copy."
**Preconditions**: Chief's message ends with three file cards: "board-update.md" (Markdown), "runway.html" (HTML), "notes.xlsx" (not previewable).
**Ideal path**: 1 — click the card.
**Alternate paths**: Artifacts page (STORY-APP-130).

##### Steps
1. Sees a rounded card with a file icon, the name and a size like "12 KB", and a download arrow on the right (`components/ArtifactFileCard.tsx:60-108`). Clicks the left side. A large dialog opens with the file name, a download icon and "Close preview" (X) (`:111-190`). Markdown renders as text; HTML runs in a sandbox; PDF in the PDF viewer.
2. While loading: "Loading preview…". Clicks the download arrow in the dialog; the file saves.
3. Closes the dialog. Focus returns to the card.
4. For "notes.xlsx" the card has no arrow and no preview. It shows the name and "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet · 8 KB"; clicking it downloads (`:45-70`). **Hesitation:** the raw MIME type is shown and nothing says "click to download".

##### Edge Cases
- Download fails: red "Could not download notes.xlsx. Try again." under the card (`:38,222-228`).
- A Markdown or HTML file that is not valid UTF-8: "This file is not valid UTF-8 text." (`:143`).
- Preview fails: "Could not load this file." (`:150`).

### Stories: Agent and settings panels at phone width

#### STORY-APP-134: Maya asks the Inbox agent from her phone

**Type**: medium
**Topic**: Page agent panel, phone
**Persona**: Founder on a 390 px phone
**Goal**: "Ask 'what needs a reply?' without losing the inbox."
**Preconditions**: Phone width; Inbox with 20 messages; Inbox agent exists.
**Ideal path**: 3 — tap Ask, type, close.
**Alternate paths**: Finance and Cap table behave alike.

##### Steps
1. Opens Inbox via the drawer. The page shows the list. The agent panel is closed by default and is not remembered open on a phone (`pages/Shell.tsx:487-505`). A button "Ask" with a message icon sits in the page header (`components/AskBotButton.tsx:6-22`, `pages/Inbox.tsx:712`).
2. Taps "Ask". A panel slides over the page from the right, full width up to 384 px (`pages/ResizableSidePanel.tsx:81`). The panel header shows the bot's name and a "Collapse Inbox agent" button (`Shell.tsx:4395-4412`). Inside is the introduction with suggested questions such as "What needs a reply from me today?" (`:2699-2704`).
3. Taps a suggestion. The question is sent and the agent answers in the panel. The inbox is hidden behind it.
4. Taps "Collapse Inbox agent" (a panel-close icon). The inbox is back.
5. Finance works the same with "Collapse Finance agent"; Cap table with "Collapse Carta agent", plus "Try again" if creating the agent failed (`:2706-2735`).

##### Variations
- If no Inbox agent exists, the panel shows a single "Create Inbox agent" button (`:4430-4441`).
- Resizing a desktop window narrower than 768 px collapses the Inbox and Cap table panels so they do not cover the page; the saved preference stays for the desktop (`:2682-2685`, `lib/carta-agent.ts:89-101`).

##### Edge Cases
- Cap table without Carta connected: the panel stays shut; the page shows its own connect card.
- On a phone the panel hides the Ask button underneath, so closing is only through the panel's own button.

#### STORY-APP-135: Maya opens a bot's settings, page or computer on her phone

**Type**: short
**Topic**: Bot panels, phone
**Persona**: Founder on a phone
**Goal**: "Rename the Hiring helper."
**Preconditions**: Phone width; MOCK Hiring helper chat open.
**Ideal path**: 3 — tap the name, edit, close.
**Alternate paths**: none found.

##### Steps
1. Taps the bot name in the chat header (`data-testid="bot-settings-trigger"`, `pages/Shell.tsx:4243`). The settings panel covers the whole chat, like the page agents. Its top line reads "Settings" with a small gear and an X ("Close panel") (`:4455-4505`).
2. Edits the name, taps Save (part B, STORY-APP-010). Taps X. The chat returns.
3. Other header icons open other panels the same way: "Page" (only if the bot has a page), "List" (pins), and the bot computer icon (title "Bot computer") (`:4268-4310`). The computer panel shows a preview and "Open" for full screen.
4. The group "Group settings" panel is the same pattern (part B).

##### Variations
- On a wide window these panels sit beside the chat; a draggable divider changes their width (STORY-APP-136). The panel kind is remembered per bot and returns after reload on wide screens (`pendingPanelRestore`, `:2890-2950`).
- The List icon is hidden on very wide screens when no panel is open, because the list is shown inline there (`:4293`).

##### Edge Cases
- Panel and drawer cannot be open together: the main area is inert while the drawer is open (`:4198`).

#### STORY-APP-136: Maya resizes the side panel with mouse and keyboard

**Type**: short
**Topic**: Resizable side panel, desktop
**Persona**: Founder with a laptop
**Goal**: "Make the Finance agent panel wider."
**Preconditions**: Desktop width; any panel open.
**Ideal path**: 1 — drag the divider.
**Alternate paths**: Keyboard.

##### Steps
1. Moves the pointer onto the left edge of the panel (an 8 px strip with a column-resize cursor) and drags left. The panel width changes live, between 320 and 1000 px, and never leaves less than 320 px for the chat (`pages/ResizableSidePanel.tsx:5-18,84-111`).
2. Focuses the divider with Tab (named "Resize panel") and presses Left or Right arrows: 32 px per press; Home sets the minimum; End the maximum (`:115-126`).
3. Reloads. The width is saved in the browser (`rakazo:right-panel-width`, `:5,48-54`).
4. Hides the sidebar: the maximum width grows by the sidebar's 316 px (`:41,56-63`).

##### Edge Cases
- Not shown on a phone (the divider is `hidden md:block`, `:91`).
- A saved width wider than the new window is clamped; the stored value stays.

### Stories: Window chrome and updates

#### STORY-APP-137: Maya uses the desktop app on Windows

**Type**: short
**Topic**: Window chrome
**Persona**: Founder using the Windows desktop build
**Goal**: "Close or minimize the window."
**Preconditions**: Desktop app on Windows or Linux (frameless window); macOS for comparison.
**Ideal path**: 1 — click a window control.
**Alternate paths**: Keyboard shortcuts of the OS.

##### Steps
1. In the app shell, three small colored circles sit at the top left of the sidebar: red "Close", yellow "Minimize", green "Fullscreen" (`pages/WindowChrome.tsx:18-35`, placed at `Shell.tsx:3354`). Clicking each calls the window action. On macOS the real traffic lights show and the app only leaves a 72 px gap (`:13-17`, `desktop/src/window-options.ts:20-24`).
2. Hides the sidebar. The circles move into the chat header, left of the Show sidebar icon (`Shell.tsx:4219`).
3. Opens the Welcome page signed out: circles are there too (`pages/Welcome.tsx:9-11`).
4. Opens `/sign-in`, `/sign-up`, the paywall or onboarding. No circles, no drag area (`AuthFrame` in `pages/Auth.tsx:430-453` has none; `Onboarding.tsx` has none). **Hesitation:** on a frameless Windows window she cannot close or move the window from these screens. Not verified on a real desktop; see Suspected problems.

##### Edge Cases
- In a normal browser the circles are replaced by an invisible spacer.

#### STORY-APP-138: The desktop app offers an update

**Type**: short
**Topic**: Desktop updates
**Persona**: Founder using the desktop app
**Goal**: "Get the latest version without losing my chat."
**Preconditions**: Desktop app; an update has been downloaded.
**Ideal path**: 2 — click "Restart to update".
**Alternate paths**: Settings → Updates → "Check for updates".

##### Steps
1. A small card appears at the bottom right with "Restart to update" and "Later" (`components/DesktopUpdates.tsx:88-120`). Its label is "Desktop update". The card appears on every screen, including sign-in, because the provider wraps the app (`main.tsx:61`).
2. Clicks "Later". The card hides for this version only (`:92,106-111`); a newer version shows again.
3. Opens Settings → Updates. The "Desktop app" block shows "v1.14.2" (MOCK) and a "Check for updates" button; the button reads "Checking…", "Downloading…" with a percent, or "Restart to update"; a line under it says "Up to date" after a check that finds nothing (`:132-170`, `pages/SettingsOverlay.tsx:144`).
4. Clicks "Restart to update". The app restarts. **Hesitation:** no warning about drafts or running bots. A running bot continues on its own computer.

##### Edge Cases
- A failed check/install shows the message in the card or under the button, and the card offers "Check for updates" again (`:46-68,92-95`).
- In the browser version none of this exists (the block returns nothing, `:128`).

#### STORY-APP-139: The server owner updates the self-hosted app

**Type**: short
**Topic**: Web software update
**Persona**: Maya as deployment owner
**Goal**: "Install the latest Praci."
**Preconditions**: Deployment owner; an update available.
**Ideal path**: 2 — Settings → Updates → update.
**Alternate paths**: none found.

##### Steps
1. Opens Settings → Updates. Under "Software update" the page shows "Up to date" or "Update available" with a button (`components/SoftwareUpdateSection.tsx`). Only the deployment owner sees the action.
2. Starts the update. The page shows progress, then "Waiting for the API to come back…", then "Updated".
3. Failure paths: "Update finished with errors", "Update failed", or "The API did not come back. Refresh this page.".

##### Edge Cases
- Non-owners see no update controls.

### Stories: Unknown URLs and error screens

#### STORY-APP-140: Maya mistypes a URL

**Type**: short
**Topic**: Not found
**Persona**: Naive first-time founder
**Goal**: "Open Finance by typing the address."
**Preconditions**: Signed in.
**Ideal path**: 2.
**Alternate paths**: none found.

##### Steps
1. Types `/app/financee`. The route `/app/:botId` accepts any text as a bot id, finds no such bot, and the app moves her to the first bot (Chief) and rewrites the address (`App.tsx:196`, `pages/Shell.tsx:1127-1133`). No message says the page was not found. **Hesitation:** she lands in a chat and wonders what happened.
2. Types `/app/finance/anything`: that matches the Finance route (`/app/finance/*`) and shows Finance's own "Not found" page inside Finance (`pages/finance/FinanceNotFound.tsx`).
3. Types `/pricing` or `/app/inbox/extra`: no route matches. React Router renders nothing and the page is blank apart from the background (`App.tsx:135-198`, no catch-all route). She must use Back or edit the address.
4. Types `/app/g/not-a-group`: she is moved to the first bot, again silently (`Shell.tsx:1122-1125`).

##### Edge Cases
- Signed out: every `/app...` address goes to `/sign-in` first.

#### STORY-APP-141: A part of the app breaks

**Type**: short
**Topic**: Error boundaries
**Persona**: Naive first-time founder
**Goal**: "Keep working even when something fails."
**Preconditions**: A network blip that fails to load a code chunk; a rendering error in one section.
**Ideal path**: 2 — read, press Refresh.
**Alternate paths**: Close the dialog and keep chatting.

##### Steps
1. Opens Settings while the browser cannot load that screen's code. A dialog titled "Could not load" with "Close" and "Refresh" appears over the chat (`components/ErrorBoundary.tsx:50-82`). Her typed draft and the chat stay. A browser keeps a failed module for the page's life, so only Refresh fixes it. **Hesitation:** the dialog gives no reason or advice like "check your connection".
2. Opens Integrations or Artifacts and the page crashes while rendering. A small red line "Could not load" shows where the page would be; the sidebar and the rest still work (`ErrorBoundary.tsx:31-37`, `Shell.tsx:4316-4332`).
3. A crash outside any inner boundary shows a full-screen "Something went wrong. Try again." with "Refresh" (`App.tsx:258-279`).

##### Edge Cases
- Clicking Refresh reloads and keeps the session.
- Finance and Cap table do not sit inside the small boundary, so a crash there goes to the full-screen error (`Shell.tsx:4333-4350` renders them directly).

#### STORY-APP-142: Maya's connection drops while the app is open

**Type**: short
**Topic**: Session unavailable
**Persona**: Founder on a train
**Goal**: "Keep my place."
**Preconditions**: Signed in; the session lookup fails to reach the server.
**Ideal path**: 1 — the app waits and recovers by itself.
**Alternate paths**: "Retry now".

##### Steps
1. The app shows "Reconnecting" with a spinner and "Can't reach the server." and a "Retry now" button (`App.tsx:232-253`). It does not send her to sign-in, because a failed lookup is not a sign-out (`App.tsx:204-208`).
2. The app retries with growing delays. She presses "Retry now" for an immediate retry (`:243-247`).
3. The connection returns; the app shows the shell again. If the session really ended, she is sent to `/sign-in`.

##### Edge Cases
- While the app is already open, a dropped connection is handled per feature (errors in chat, composer drafts kept); this screen appears only on the initial session lookup.

#### STORY-APP-143: Maya deletes every bot

**Type**: short
**Topic**: Empty sidebar
**Persona**: Naive first-time founder
**Goal**: "Start over."
**Preconditions**: A space with one bot and no groups; nothing archived; no other space with content.
**Ideal path**: 2.
**Alternate paths**: none found.

##### Steps
1. Archives and deletes the last bot. The refresh finds nothing and the app sends her to `/onboarding` (`pages/Shell.tsx:1106-1119`). She meets "Opening chat…" and a fresh Chief with its greeting.
2. If another space has content, she stays in the app. The main area shows a button "New bot" with a plus (`:4358-4366`); the header says nothing useful. Pressing it creates a bot named "New Bot" and opens its settings with the name selected.

##### Edge Cases
- If only archived bots exist, she stays in the app with an empty bot list and the "Archived" block (`:3975-3985`).

### Stories: End-to-end journeys

#### STORY-APP-144: Maya's first day, start to finish, on her phone

**Type**: long
**Topic**: Phone, whole first-run journey
**Persona**: Naive first-time founder, on a 390 px phone in a taxi
**Goal**: "Sign up, connect my email, ask one question, find the document Chief made, and sign out."
**Preconditions**: No account; Composio set up; a phone browser; pop-ups allowed.
**Ideal path**: 14 — sign up, 3 onboarding steps, 3 Chief steps, 5 navigation steps.
**Alternate paths**: Desktop (STORY-APP-001 and 145).

##### Steps
1. Opens the site. Welcome shows the logo, the tagline "Bots that run your inbox, cash, cap table and investor documents." and "Sign up →" / "Sign in" (`pages/Welcome.tsx`). Taps Sign up.
2. Fills Name, Email, Password on the Create your account form. The email keyboard opens (type email). Taps the eye to check the password. Taps "Create account" ("Working…").
3. "Loading…" then "Opening chat…". Lands in Chief's chat. The drawer is closed; the header shows a menu icon, Chief's name and the bot-computer icon.
4. Reads Chief's greeting and the focus card; taps A "Run my company". Sees a Gmail card and a Calendar card; taps "Authorize" on Gmail. The phone opens Google in a new tab or window; she approves and comes back. The card has changed to "Connected" if the polling tab kept running (the page polls every 2 s; browsers may pause timers in a background tab, which is untested here, so she might see "Waiting…" until she returns) (`message-cards.tsx:182-194`). **Hesitation:** unclear whether to wait.
5. Types "What should I look at first today?" with the on-screen keyboard and taps send. The reply streams.
6. Taps the menu icon. The drawer opens: bell, search, Inbox, Finance, Cap table, Data room, Artifacts, bots, Integrations, account. Taps Inbox; the drawer closes and the Inbox loads.
7. Taps "Ask" in the Inbox header; the Inbox agent covers the page; asks "What needs a reply today?"; collapses it (STORY-APP-134).
8. Opens the drawer, types "investor" in "Search chats", taps the Documents result. Data room opens.
9. Opens the drawer again and taps Artifacts. Opens a card, reads on a squeezed screen (see Suspected problems), taps Download.
10. Opens the drawer, taps her name, "Hide amounts" (she is about to show a friend), then "Log out". Lands on Welcome.

##### Variations
- Permission prompt for notifications appears at step 5 on browsers that support it; many phones do not.
- She rotates the phone to landscape at step 9; above 768 px the layout becomes the desktop one and the drawer state resets.

##### Edge Cases
- Network drops at step 3: "Could not create your bot", "Try again" (STORY-APP-112).
- Row "..." menu is not available on touch (STORY-APP-121); she cannot rename or delete a bot without long-press.

#### STORY-APP-145: Maya's Monday on the laptop: palette, search, Activity, hide amounts, artifacts

**Type**: long
**Topic**: Desktop, returning-user journey
**Persona**: Naive founder in week two
**Goal**: "Get ready for the board call: check what happened, find the update and deck, avoid showing cash on the shared screen."
**Preconditions**: Full seed; desktop width; notification permission granted; Activity seed.
**Ideal path**: 12.
**Alternate paths**: Mouse-only, with the sidebar.

##### Steps
1. Opens `/`. Already signed in, the app goes to `/app` and Chief (`App.tsx:136`).
2. Notices a dot beside "MOCK Finance helper" (unread) and the Inbox badge "3".
3. Clicks the bell. "Needs you" shows Chief "Needs input". Clicks it; Chief's chat opens with the question. Answers. Clicks the bell again to close the block.
4. Presses Cmd+K, types "cap", Enter. Cap table opens. Clicks the eye icon in its header ("Hide amounts") so the call does not show holdings.
5. Presses Cmd+K, types "arti", Enter. Artifacts opens. Switches to List view. Opens "Q3 investor update draft", picks version v3, reads it.
6. Clicks "Download". Saves the file.
7. Types "SAFE" in "Search chats". Clicks the Documents result "Seed SAFE.pdf". Data room opens with it selected.
8. Clicks "Search mail for “SAFE”" next time; the Inbox filters the mail.
9. Clicks "Hide sidebar" so the screen share shows only the chat. Opens Chief and sends "Draft the board update opening paragraph" (part B).
10. Switches to another tab; Chief finishes; a notification shows with the first lines of the reply, currency masked because Hide amounts is on (`browser-notifications.ts:85`).
11. Comes back, clicks "Show sidebar" in the header, opens the account menu, reads the Hide amounts row ("Show amounts"), turns it off after the call.
12. Logs out.

##### Variations
- If the call starts at once, she may press Cmd+K repeatedly; the palette toggles.

##### Edge Cases
- At step 3, the Needs input run belongs to a bot she archived; the row still opens its chat.
- At step 10, if she is looking at Finance instead of Chief, no notification arrives (STORY-APP-126).

#### STORY-APP-146: Maya, who installed Praci herself, sets up the whole server

**Type**: long
**Topic**: Self-hosted first run
**Persona**: Maya as both installer and first user
**Goal**: "Get my own Praci running for Northwind, with a model and apps."
**Preconditions**: Fresh deployment; no model; no Composio key; Maya is the first account (deployment owner); billing off.
**Ideal path**: 9.
**Alternate paths**: Configure integrations later in Settings.

##### Steps
1. Opens the site; Welcome; Sign up; fills the form; "Create account".
2. Sees "Connect a model" (STORY-APP-108). Picks the first provider, pastes a MOCK key, presses "Test API key", sees success, presses "Continue".
3. Sees "Server integrations" (STORY-APP-109). Picks "Popular apps through Composio", pastes an MOCK API key, "Connect". The row shows a "Connected" label (`IntegrationSetup.tsx:218`). Presses "Continue".
4. "Opening chat…", then Chief with the greeting and focus card. Picks "Run my company".
5. Chief shows Gmail and Calendar cards because the catalog is now available. Authorizes Gmail.
6. Opens the sidebar's Integrations page; sees Gmail connected.
7. Opens the account menu → Settings → Updates (owner sees "Software update", STORY-APP-139).
8. Invites no one: there is no members screen (part B, STORY-APP-023).
9. Logs out and in again to confirm the account works; lands on `/app`.

##### Variations
- She skips "Server integrations": Chief shows no app cards for the focus choice and instead posts the note or "What would you like to work on first?" (`onboarding.ts:327-332`). She must set up the catalog from Integrations ("Set up app catalog", part B).
- She skips the model (not possible): "Continue" is disabled until a model is ready.

##### Edge Cases
- A wrong MOCK key: "Test API key" reports a failure and Continue stays possible; saving may still fail with "Could not save model".

### Redundancy Candidates (this area)

- **Seven search boxes with different scopes.** Sidebar "Search chats" (chats, pages, documents, a mail row), the palette's "Search" (bot, group and page names only), the "+" picker's "Search" (bots), Inbox "Search mail", Data room search, "Search artifacts…" and Activity "Search runs". A first-timer cannot tell which one finds "the SAFE" (STORY-APP-007, 119, 120, 129, 125).
- **Three controls for hiding the sidebar.** The panel icon in the sidebar header, the invisible edge handle, and the "Show sidebar" icon in the chat header (STORY-APP-009, 122).
- **Hide amounts in three places.** Finance header, Cap table header and the account menu. The first two are the same component and are good; none is in the Inbox or Data room header (STORY-APP-128).
- **Files in two areas.** Data room (files the user uploads) and Artifacts (files bots make) sit side by side and both open documents. The icons now differ; the names do not say how (STORY-APP-006).
- **Settings reached from three places.** Account menu "Settings", palette "Settings" and sidebar search "Settings". "Usage" is both a Settings section and its own account-menu row (STORY-APP-005, 119, 120).
- **Bell, unread dots and Inbox badge.** Three signals for "something needs me": the bell's Activity list (runs), per-row unread dots, and the Inbox count. None of them lists replies from bots (STORY-APP-124).
- **Check-your-email screen reused.** The same title serves password reset and sign-up verification, but only the reset path explains itself and offers "Send again" (STORY-APP-102, 003).
- **Sidebar "Add page" machinery with nothing to add.** `SidebarPages`, `AddSidebarPage`, the API route and a database table exist for one template that cannot be added (STORY-APP-118).
- **Overlap with part B.** Prior STORY-APP-016 (notifications, part B) and stories 124 to 127 cover the same ground; keep one set when merging.

### Suspected problems (this area)

Each item was found by reading code, not by running the app, unless it says otherwise. None has been confirmed in a browser.

1. **Sign-up verification screen gives no help.** After "Create account" with email verification on, the screen is titled "Check your email" and shows only "Back to sign in". The sentence about which address got the mail, and the "Send again" button, are inside the `resetSent` branch only (`pages/Auth.tsx:153-176`, with `sent` true for `?verify=email` at `:35`). A user whose mail does not arrive has no way to resend (STORY-APP-102).
2. **Saved links are lost at sign-in.** A signed-out visit to `/app/finance` goes to `/sign-in` with no `next`; after sign-in she lands on `/app` and the first bot. Only `/integrations/setup` is carried through (`App.tsx:96-97,180-182`, `pages/Auth.tsx:115-121`) (STORY-APP-106).
3. **Unknown addresses fail silently.** `/app/<anything>` becomes "bot not found" and redirects to the first bot with no message (`Shell.tsx:1127-1133`, `App.tsx:196`). Addresses with extra segments such as `/app/inbox/x` or `/pricing` match no route and render a blank page; there is no catch-all route (`App.tsx:135-198`) (STORY-APP-140).
4. **Sidebar search never says "No results".** `SpaceSearchResults` treats a result set as non-empty whenever `onSearchMail` is given, and the Shell always gives it, so a search for nonsense shows only "Search mail for “…”" (`pages/SpaceSearch.tsx:80,118-129`) (STORY-APP-007). The "No results" and "Searching…" branches at `:81-94` are unreachable from the sidebar.
5. **Browser notifications cover less than users expect.** Events that notify are bot messages, failed runs and cancelled runs only; "Needs input" is not one of them (`lib/browser-notifications.ts:47-61`). The stream that triggers a notification belongs to the open chat only (`Shell.tsx:1521,1652`; `shouldNotifyBrowser` checks `subscribedThreadId` at `browser-notifications.ts:63`). If Maya is on Finance or Inbox (which open their own agent), Chief's reply produces no notification (STORY-APP-126). The notification has no click handler (`Shell.tsx:1016`).
6. **The bell is not notifications.** Its tooltip and label are "Activity" and it opens a run list. Users who expect a bell to list replies and approvals will not find them there (`Shell.tsx:3354-3376`, STORY-APP-124). A permission "denied" state is never explained, and the per-bot "Notifications" switch stays on regardless (STORY-APP-127).
7. **Artifact preview on a phone is probably squeezed.** When a file is open, `IndexPane` is a fixed `w-[320px] shrink-0` column with no hide-on-small-screens rule (`pages/Artifacts.tsx:501`), next to the preview. At 390 px that leaves roughly 70 px of preview unless she finds "Maximize" (STORY-APP-130, 144). Not checked in a browser.
8. **Hover-only controls on touch screens.** The Artifacts delete icon shows only on hover or keyboard focus (`pages/Artifacts.tsx:681,740`). The bot row "..." button is hidden on touch (`Shell.tsx:3956`), leaving long-press (browser context menu) as the only way to rename, archive or delete a bot (STORY-APP-005, 121, 131). Whether long-press works on iOS Safari is unverified.
9. **Window chrome is missing on sign-in screens (desktop only).** On Windows and Linux the main window is frameless (`apps/desktop/src/window-options.ts:21`) and the custom close/minimize circles are rendered only in the Shell, Welcome and Board pages (`WindowChrome` usages at `Welcome.tsx:10`, `Shell.tsx:3354,4219`, `Board.tsx:107`). Sign-in, sign-up, forgot-password, onboarding and the paywall have none, so the window cannot be closed or dragged from them (STORY-APP-137). Not run on a real desktop.
10. **A connect card hides a blocked pop-up.** `window.open` is not checked; if the browser blocks it, the card says "Waiting…" for about two minutes before "Authorization timed out. Please try again." (`pages/shell/message-cards.tsx:177-195`) (STORY-APP-111).
11. **Paywall dead end for non-managers.** Without billing rights the user sees only "Subscription required" and "Log out", with no sentence about who can subscribe (`pages/Paywall.tsx:63-81`) (STORY-APP-113).
12. **Server integrations step may render blank.** `IntegrationSetup` returns nothing when `serverSetup` is true and the user cannot configure the server (`components/integrations/IntegrationSetup.tsx:164`), and the Skip button lives inside the part that is not rendered. Whether a non-owner is ever sent there depends on server data not read here (STORY-APP-109).
13. **Sign-in blocks short passwords in the browser.** The password field has `minLength={8}` in every mode, including sign-in (`pages/Auth.tsx:261`). An older account with a shorter password cannot even submit the form, and the browser tooltip does not say why. Possible only if such accounts exist.
14. **Sign-up name defaults to the email prefix and then feeds the greeting.** If Name is left empty, the account name becomes the part before "@" (`pages/Auth.tsx:103`), and Chief's first message says "Hi maya.new" (`apps/api/src/onboarding.ts:122-123`) (STORY-APP-001).
15. **Palette numbers follow the unfiltered list.** Cmd+2 opens the second bot of all bots even when the typed filter shows different rows (`pages/shell/command-palette.tsx:68-83`) (STORY-APP-120). The shortcut hint beside a filtered row is the right number for that bot, but the order on screen differs.
16. **Focus card hides what each choice does.** Options show only labels; the summary that explains what A to E mean ("cash, cap table, investors, and email") appears only in Chief's reply after choosing (`message-cards.tsx:102-123`, `onboarding.ts:34-71`). B and C offer the same three apps in different order (STORY-APP-002).
17. **Artifacts page offers no recovery.** Load failure shows red text with no Retry; an empty list says only "No artifacts found." with no hint what artifacts are (`pages/Artifacts.tsx:122,371-385,455-462`) (STORY-APP-132). Non-previewable chat file cards show a raw MIME type such as `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (`components/ArtifactFileCard.tsx:60-70`) (STORY-APP-133).
18. **Paywall copy.** "Any model, with your own key" can read as "bring and pay for your own model on top" (`pages/Paywall.tsx:41`) (STORY-APP-004).
19. **Sidebar Add page is dead weight.** See Redundancy; `/app/team-health` quietly redirects to the first bot (`sidebar-pages.ts:4-11`, `Shell.tsx:1130-1133`) (STORY-APP-118).
20. **Hide amounts is per browser and partial.** It is stored in the browser (`lib/hide-amounts-preference.ts:7,16-24`), not in the account; it masks currency text and hides charts but the tooltip itself warns that plain numbers can show (`components/HideAmountsToggle.tsx:7-8`). Inbox and Data room have no header button (STORY-APP-128).

## Area: App shell B (STORY-APP-nnn)

Source: `docs/ux-paths/app/catalog-b.md` (part B of the App shell area; part A covers sign-up, sidebar, navigation, command palette and Activity).

Generated: 2026-10-17
Code read at: `559a76ad` (branch `docs/ux-pass`). All file:line references are to `apps/web/src/` unless another root is given.
Total Stories: 55 (33 short, 20 medium, 2 long)
Scope: Chief and bot chats (composer, attachments, reactions, replies, quotes, tables, tool activity, approvals), adding and removing bots, bot settings (credentials, avatar, model, memory, skills, scratchpad, pins, page), group chats and @mentions, peer messages, routines, Integrations (catalog, app detail, MCP servers, custom connection, server setup, OAuth callbacks), Settings (account, models and backups, voice, memory, messaging, approval rules, AI data sharing, updates, language and theme), billing and usage, and members/invites.

### Changes since the 2026-10-16 catalog

Part A owns APP-001..009 and the journeys agent owns APP-024. This file owns APP-010..023, APP-025 and new ids APP-151..199.

**Kept (id and goal unchanged, steps and labels corrected against the code):** STORY-APP-010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020, 021, 022, 023, 025.

**Changed (what moved in the code):**
- STORY-APP-010: "+" now says "New bot" (not "Create new Bot"). Creating a bot opens its Settings with the Name field selected (`pages/Shell.tsx:2765`, `focusName` at `pages/shell/bot-panel.tsx:96-100,390-391`). The old catalog said the first-time user had no naming step. The sidebar menu says "Edit profile" and "Mark as read" (`pages/BotContextMenu.tsx:126,131`).
- STORY-APP-011: The group copy says "They all reply in the same thread" (`pages/shell/dialogs.tsx:204`), but only the first member answers unless the message names someone (`packages/core/src/group-mentions.ts:52-54`). The old story said "both bots reply". Fixed.
- STORY-APP-012: The microphone no longer dictates; it starts a voice call (`pages/Shell.tsx:3224-3238`). Limits are 4 files and 10 MB each (`packages/contracts/src/attachments.ts:1-2`). Send and Stop are both shown during a run (`pages/Shell.tsx:7098-7122`).
- STORY-APP-013: Reactions are stored as replies, cannot be removed, and the pills are not clickable (`packages/core/src/message-reactions.ts:20-38`, `pages/Shell.tsx:6037-6056`).
- STORY-APP-014: Page size is 10 rows, "Expand table" opens a dialog with "Close table" (`packages/chat-ui/src/markdown-table.tsx:196-262`).
- STORY-APP-015: Mentions now cover bots, groups, routines and apps; a chip-only group mention opens the group without sending (`packages/core/src/composer-mentions.ts:284-298`). A "Sent to {group}" notice with an "Open" link replaces the old silent reroute (`pages/Shell.tsx:3178-3197`).
- STORY-APP-016: The Activity view has sections "Needs you", "Working", "Finished" (`pages/ActivityList.tsx:164-174`).
- STORY-APP-017: Copy says "Bots lose access" and the row button reads "Remove account" (`components/integrations/AppDetail.tsx:109,410`).
- STORY-APP-018: The custom connection form is now URL-only with an "Advanced" disclosure; the "Authentication" dropdown is gone. Connect starts a sign-in window by default (`components/integrations/CustomConnectionDialog.tsx:465-660`).
- STORY-APP-019: Settings → General has a "Server integrations" card with an "Open" button (`pages/AccountSettingsOverlay.tsx:222-244`). The page is inside the app at `/app/integrations/setup` (`pages/Integrations.tsx:19`). A non-owner is sent back to `/app` without a message (`pages/IntegrationSetup.tsx:30-33`).
- STORY-APP-020: Models has "Test API key", "Active model", a "Data room search model" disclosure and "Backup models" (`components/ModelConnectionPreflightNotice.tsx:34`, `pages/ModelSettingsOverlay.tsx:1579`, `pages/ModelBackupsSettings.tsx:249`).
- STORY-APP-021: General now has Account (with Delete account), Password, AI data sharing, Appearance, Language, Avatars, Server integrations (owner) and an "Advanced" disclosure holding Stream replies, Show tool activity, Load web images automatically and Action confirmations (`pages/AccountSettingsOverlay.tsx:100-318`).
- STORY-APP-022: Billing shows price and seat count; Usage shows runs and tokens (`pages/BillingSettingsPanel.tsx:76-102`, `pages/AccountSettingsOverlay.tsx:336-351`).
- STORY-APP-023: Still no invite or members UI. The Billing panel now prints a seat count, which makes the gap more confusing.
- STORY-APP-025: The long investor-update flow now passes through the Quote button, the mail approval card and the Action confirmation setting.

**Dropped:** none. Every earlier story in this range still has a matching surface.

**Added (new ids):** STORY-APP-151..174 and 176..191 (STORY-APP-175 is not used; see the coverage matrix). Reasons: Quote selection, the voice call button, the slash picker, history recall, attachment limits, tool activity disclosure, approval cards, bot credentials, Avatar Studio, per-bot advanced settings, per-bot memory and skills, Open work, List and Page panels, clearing and deleting bots, peer messages, group replies, child bot cards, send failures, routine mentions, routines (create, triggers, pause/delete), Integrations (connect, bot access, first-party tiles, reconnect, OAuth callback, other connection types, Finance tiles), backup models, language, AI data sharing, account deletion, Updates, Memory settings, Voice settings, Messaging, and the Settings window itself.

### Persona (applies to every story)

Maya Chen, cofounder and CEO of "Northwind Robotics" (a 9-person warehouse-robotics startup). She has never seen Praci. She does not know the words "bot", "space", "group", "MCP", "routine", "provider", "thinking", "scratchpad", "webhook" or "token". She wants one place to run the company: read email, know the cash position, keep the cap table and investor documents straight, and hand repeat work to someone reliable. Each story records what she tries in her own words, what she expects, and where she pauses. Pauses are marked **Hesitation:**.

### Mock demo data and preconditions (shared seed)

Every user-visible string in the seed contains `MOCK DEMO DATA` or starts with `MOCK` so a walker never mistakes it for real data.

| Seed item | Value |
|---|---|
| User | Maya Chen, `maya@northwind.example` (MOCK DEMO DATA), password set, deployment owner unless a story says otherwise |
| Space | "Northwind Robotics" |
| Model | One working deployment model; no personal API key |
| Bots | "Chief" (onboarding finished), "MOCK Finance helper" (title Finance), "MOCK Hiring helper" (title Recruiting), archived "MOCK Old intern bot" |
| Group | "Leadership" with Chief and MOCK Finance helper |
| Section | "MOCK Ops" containing MOCK Hiring helper |
| Chief thread | 12+ messages: one reply with a 14-row table ("MOCK DEMO DATA monthly burn by category", columns Category, Amount, Change), one message with a 👍 reaction, one user reply to an earlier message, one peer-message marker "Messaged MOCK Finance helper" |
| Integrations | Gmail connected (`maya@northwind.example`, MOCK), Slack connected (MOCK workspace), one custom connection "MOCK DEMO DATA Docs MCP" at `https://mcp.mock-northwind.example/mcp` |
| Routines | None for Chief at the start; story APP-172 creates "MOCK Monday cash check" |
| Files | Local files: "MOCK DEMO DATA board memo.pdf" (2 MB), "MOCK DEMO DATA cap table.xlsx" (1 MB), "MOCK DEMO DATA deck.docx" (3 MB), "MOCK DEMO DATA raw export.pdf" (14 MB), five 100 KB PNG screenshots |
| Billing | Billing enabled, subscription in Trial (5 days left); a second MOCK member account "Sam Patel" who is not the deployment owner |

### Summary

| Type | Count |
|---|---|
| Short | 33 |
| Medium | 20 |
| Long | 2 |

### Coverage Matrix

| Feature | Stories | Gaps |
|---|---|---|
| Send, stop, attach, drag/paste, history recall, slash picker | 012, 153, 154, 155 | Voice dictation does not exist; the mic is a call button (152) |
| Hover actions: react, reply, copy, speak; quote selection | 013, 151 | Reaction removal does not exist |
| Tables in chat | 014 | Table labels are English-only |
| Tool activity disclosure | 156 | Off by default; only reachable from Settings → Advanced |
| Approvals (tool, secret, mail) | 157, 158, 025 | Mail approval card mechanics are in prior STORY-031..033 |
| Mentions: bots, groups, routines, apps | 015, 168, 171 | `@everyone` only inside a group (168) |
| Group chats | 011, 168 | Adding a bot to a running group is covered in 168 only |
| Peer messages | 167 | The overlay is view-only; no reply path |
| Child bot card and handoff | 169 | Created by a tool, hard to seed by hand |
| Send/stop failures | 170 | Network-offline banner not covered |
| Notifications | 016 | Desktop (Electron) notifications not covered |
| Add, rename, clear, delete, archive bot | 010, 166 | Archive/restore sidebar rows are part A |
| Bot settings: Name/Title/Description/Notifications | 010 | |
| Bot settings: Advanced (Computer, model, thinking, voice, tools) | 161 | Computer panel and teaching are not covered here (no story owns them in this file) |
| Bot credentials | 159 | |
| Avatar Studio | 160 | Image upload not walked end to end |
| Bot Memory tab, Shared skills | 162 | |
| Open work (scratchpad) | 163 | |
| List and Page panels, pins strip | 164, 165 | Pins and Page are created by the bot; no manual create path |
| Routines: create, schedule, test, history | 172 | One-shot arming only as an edge case |
| Routines: triggers and model | 173 | Teams and other "Coming soon" triggers disabled |
| Routines: pause, delete, stop | 174 | |
| Integrations: connect, bot access, disconnect | 176, 177, 017 | |
| Integrations: custom MCP, other types | 018, 181 | Local command only walked as a variation |
| Integrations: first-party tiles, Finance | 178, 182 | |
| Integrations: reconnect, OAuth callback | 179, 180 | |
| Server integrations (owner) | 019 | Desktop `/desktop-settings` page not covered |
| Settings window | 191 | |
| Account: theme, language, password | 021, 184 | |
| Account: delete | 186 | Link SSO only as a variation |
| AI data sharing | 185 | |
| Approval rules | 158 | |
| Models, own key, backups | 020, 183 | OAuth subscription sign-in only as a variation |
| Voice | 152, 189 | |
| Memory | 188, 162 | |
| Messaging | 190 | Behind a server feature flag |
| Updates | 187 | Software update only visible to the owner on a sidecar install |
| Billing and usage | 022 | |
| Members and invites | 023 | Feature does not exist |
| Long journey | 025 | |

### Story Dependency Graph

```text
Seed (shared) ── Chief chat (012)
├── 013 react/reply/copy ── 151 quote
├── 014 table
├── 153 slash ── 154 recall ── 155 attachments
├── 152 mic → Voice settings (189)
├── 156 tool activity ── 157 approvals ── 158 action confirmations
├── 015 mention a group ── 168 group replies ── 011 groups and spaces
├── 171 routine/app mention ── 172 create routine ── 173 triggers ── 174 pause/delete
├── 167 peer messages, 169 child bot card, 170 failures, 016 notifications
├── 010 add a bot ── 160 avatar ── 161 advanced ── 159 credentials
│    ├── 162 memory and skills ── 188 Settings → Memory
│    ├── 163 open work, 164 list, 165 page
│    └── 166 clear / export / delete
├── Integrations: 176 connect ── 177 bot access ── 017 disconnect
│    ├── 018 custom MCP ── 179 reconnect ── 180 callback failures ── 181 other types
│    ├── 178 first-party tiles ── 182 Finance tiles
│    └── 019 Server integrations
├── Settings window 191 ── 021 theme/language/password ── 184 language
│    ├── 020 models ── 183 backups
│    ├── 185 AI data sharing, 186 delete account, 187 Updates, 190 Messaging
│    └── 022 billing and usage, 023 invite a cofounder
└── 025 long investor update (needs 012, 013, 014, 151, 157, 158)
```


### Stories: Adding and managing bots

#### STORY-APP-010: Maya adds a Hiring helper, names it, and puts it under Ops

**Type**: medium
**Topic**: Bots — create, rename, organize, delete
**Persona**: Naive first-time founder
**Goal**: "Get a separate assistant for recruiting, call it what I want, and keep it under Ops."
**Preconditions**: Shared seed without MOCK Hiring helper; section "MOCK Ops" exists; desktop width.
**Ideal path**: 3 — "+" → "New bot" → type the name. The name field is already selected, so the new flow is shorter than the 2026-10-16 version.
**Alternate paths**: empty-state "New bot" button when there are no chats (`pages/Shell.tsx:4360-4366` (label "New bot", line 4364)); "Duplicate" in the row menu (`pages/BotContextMenu.tsx:135`); clicking the chat title opens the same Settings (`pages/Shell.tsx:4243-4248`).

##### Steps
1. Clicks the "+" at the top of the sidebar (title "Create", `pages/Shell.tsx:3386-3392`). → A small picker: "To:", a "Search" box, bot rows, then "New bot", "New group", "New space" with "About groups" and "About spaces" info buttons (`pages/shell/bot-picker.tsx:50-134`). **Hesitation:** "To:" reads like an email address line; she may type a person's name.
2. Clicks "New bot". → A bot named "New Bot" is created and opened at `/app/<id>`. The right panel opens on Settings with the Name field focused and selected (`pages/Shell.tsx:2748-2767`, `pages/shell/bot-panel.tsx:383-391`). The chat shows a fixed greeting: "Hi Maya. I'm a blank slate right now, so you get to decide what I become. What's the main thing you'd want me handling for you?" (`apps/api/src/onboarding.ts:124-126`).
3. Types "MOCK Hiring helper" over the selected name. → Name saves when the field loses focus (`bot-panel.tsx:392`). No confirmation is shown yet.
4. Tabs to Title and types "Recruiting" (placeholder "e.g. Recruiting, Sales, Legal"), then Description "Screens candidates for the warehouse team." → Each saves on blur. **Hesitation:** She cannot tell what Title and Description do. They are what the bot reads as its role (`bot-panel.tsx:396-420`).
5. Clicks "Save". → A "Saved" check appears next to the button (`bot-panel.tsx:628-642`). She now trusts the earlier blur saves.
6. Hovers the new row in the sidebar and clicks "..." ("Actions for MOCK Hiring helper"). → Menu: Pin, Move to, Mark as read/unread, Edit profile, Duplicate, Clear conversation, Archive, Delete (`pages/BotContextMenu.tsx:84-148`). Opens "Move to" and picks "MOCK Ops". → The row moves under that section.
7. Opens the menu on "MOCK Old intern bot" row and chooses "Delete". → Dialog "Delete MOCK Old intern bot?": "Its conversation, files, and routines will be permanently deleted. Bots it created stay in your list." and "What about its memories?" with "Keep memories" (Move them to your shared memory.) selected and "Delete memories too" (This cannot be undone.) (`pages/shell/dialogs.tsx:415-480`). She keeps the default and clicks "Delete". **Hesitation:** She expected "Delete" to ask only yes/no; the memory choice is new vocabulary.

##### Variations
- Phone width: the Settings panel opens full width over the chat (`pages/ResizableSidePanel.tsx:81`); she must use the panel's "Close panel" button to see the greeting.
- "Edit profile" in the row menu and clicking the chat title open the same Settings panel.

##### Edge Cases
- Create fails: "Failed to create bot" appears in the composer error banner of the chat she was in, not near the "+" (`pages/Shell.tsx:2771`).
- Name cleared to blank: the old name is kept (`bot-panel.tsx:257` `nextName || bot.name`).
- Delete fails: "Could not delete bot" inside the dialog (`dialogs.tsx:473`).

#### STORY-APP-011: Maya creates a Leadership group and wonders what a space is

**Type**: medium
**Topic**: Groups and spaces
**Persona**: Naive first-time founder
**Goal**: "Have Chief and the Finance helper work on the board deck together."
**Preconditions**: Chief and MOCK Finance helper exist; no Leadership group.
**Ideal path**: 4 — "+" → New group → name → pick 2 bots → Create group.
**Alternate paths**: none found for creating a group; spaces can also be renamed or deleted from "Actions for space" (`pages/Shell.tsx:4981-5006`).

##### Steps
1. "+" → clicks the "About groups" info button. → Dialog "Groups": "Shared chat with 2-6 bots. They all reply in the same thread." (`pages/shell/dialogs.tsx:200-206`). **Hesitation:** She now expects every bot to answer every message. The behavior is different (see STORY-APP-168).
2. Clicks "About spaces". → "Spaces": "Private workspace with its own bots and groups." She wonders if her cofounder can join one; he cannot (STORY-APP-023).
3. Clicks "New group". → Right panel "New group" with "Name" ("Name this group"), "Members (pick 2–6)", a list of bots, and "Create group" disabled until the name and 2 members are set (`pages/GroupPanel.tsx:83-146`). Types "Leadership", clicks Chief and MOCK Finance helper (check marks appear). → Clicks "Create group"; lands on `/app/g/<id>`.
4. Types "Draft three bullet points on Q3 burn" and sends. → One bot answers (the first member), not both. See STORY-APP-168 for the full behavior.
5. Clicks the group name in the header. → "Group settings": rename, change members, "Save", "Delete group" (`GroupPanel.tsx:228-278`). Rename to "Leadership team" and save; the panel closes after a successful save (`GroupPanel.tsx:221`).
6. "+" → "New space". → Dialog "New space" with "Name" (placeholder "Customer support") and "Create space" (`dialogs.tsx:60-96`). Types "Side project". → Sidebar groups by space (part A).

##### Variations
- Only one bot picked: "Create group" stays disabled; there is no message saying why. **Hesitation:** She cannot tell if the Name or the member count is missing.
- Seventh member: the seventh row ignores the click (`GroupPanel.tsx:36-41`) with no message.

##### Edge Cases
- Create fails: "Could not create group" under the form title (`GroupPanel.tsx:93`).
- Delete group: "Delete {name}?" "This cannot be undone." (`dialogs.tsx:508-511`).
- Delete a space that still has bots: "Only empty spaces can be deleted. Delete its bots and groups first." (`pages/Shell.tsx:5067`).

#### STORY-APP-159: Maya saves a login for the Finance helper in its credentials

**Type**: medium
**Topic**: Bot settings — credentials
**Persona**: Naive founder told "give the bot your bank site login"
**Goal**: "Let the Finance helper log into our bill-pay site without me typing the password each time."
**Preconditions**: MOCK Finance helper exists. Bot Settings open.
**Ideal path**: 5 — Advanced → Add credential → Name → Site → Type "Website login" → Save credential.
**Alternate paths**: The bot can ask in chat (APP-157) and save the secret from the answer card.

##### Steps
1. In the bot Settings panel, clicks "Advanced". → The disclosure opens and the Credentials section loads (`pages/shell/bot-panel.tsx:443-451,620`, `bot-credentials.tsx:227-240`). Shows "Credentials", "Values are encrypted and never shown again." and "No credentials saved for this bot." **Hesitation:** "Advanced" hides this; she may never find it unless a chat card sends her here.
2. Clicks "Add credential". → Form: "Name" (placeholder `github`, hint "Lowercase letters, numbers, hyphens and underscores, starting with a letter."), "Site" (placeholder `https://api.example.com`), "Type" (Bearer token, Custom header, Basic auth, Website login, Command variable) (`bot-credentials.tsx:380-460`).
3. Types name "mock-billpay", Site "https://billpay.mock-northwind.example", chooses Type "Website login". → Fields "Username" and "Password" appear.
4. Types "maya.mock" and a password. Clicks "Save credential". → The row appears with the site and "Updated {time}"; the password is never shown again (`bot-credentials.tsx:230,492`).
5. Clicks "Replace value" on the row, pastes a new password, "Save new value". → Row updated.
6. Clicks "Remove" on the row. → Inline question "Remove mock-billpay? This bot will no longer be able to use it." with "Remove" and "Cancel" (`bot-credentials.tsx:310-340`).

##### Variations
- Type "Command variable": the Site field disappears and a line shows how the bot's shell commands will see it ("Available to this bot's shell commands as $MOCK_BILLPAY"). Reserved names show an error (`bot-credentials.tsx:213`).
- Saved without a username on Basic auth/Website login: "Enter a username and password" (`bot-credentials.tsx:116`).

##### Edge Cases
- Credentials fail to load: "Could not load credentials."
- A saved credential that cannot be read: "These saved settings can't be read. Remove it and add it again." (`bot-credentials.tsx:269`).

#### STORY-APP-160: Maya changes a bot's picture and color in Avatar Studio

**Type**: short
**Topic**: Bot settings — avatar
**Persona**: Naive first-time founder
**Goal**: "Make the Finance helper look different from Chief."
**Preconditions**: Bot Settings open for MOCK Finance helper.
**Ideal path**: 3 — click the avatar → pick a color → Done.
**Alternate paths**: Settings → General → "Avatars" Robot/Organic changes every bot's style at once (STORY-APP-021).

##### Steps
1. Clicks the large avatar at the top of the Settings panel (aria-label "Customize bot avatar"). → Popover "Avatar Studio": "Choose a bot shape, color, or upload an image" with tabs "Bot" and "Upload", and "Reset" (`pages/shell/avatar-studio-popover.tsx:123-192`). **Hesitation:** The avatar is not obviously clickable.
2. Under "Shape", picks one; under "Color", clicks a swatch (aria-label "Color #…"). → Avatar updates and saves on each change (`bot-panel.tsx:371-378`).
3. Clicks "Done". → Popover closes. The sidebar row shows the new color.

##### Variations
- "Upload": "Drag, drop, or paste an image" or "Choose file" (`avatar-studio-popover.tsx:289-292`).

##### Edge Cases
- Reset returns to the default shape and color.

#### STORY-APP-161: Maya picks a different model for one bot and turns off a tool

**Type**: medium
**Topic**: Bot settings — Advanced
**Persona**: Naive founder following a friend's advice ("use a stronger model for finance")
**Goal**: "Make the Finance helper use a stronger model, and stop it browsing the web."
**Preconditions**: Two models connected (deployment default plus one personal key). MOCK Finance helper Settings open.
**Ideal path**: 4 — Advanced → Model → choose → Save.
**Alternate paths**: Space-wide default is in Settings → Models (STORY-APP-020).

##### Steps
1. Opens "Advanced". → Shows "Computer" (Team / Private), Open work (STORY-APP-163), Memory/Shared skills tabs (STORY-APP-162), "Model", "Thinking" (only when the model supports it), "Memory scope" (only when a memory provider is connected), "Read replies aloud", "Voice" (only when voices exist), "Disabled tools", Credentials (`bot-panel.tsx:443-621`). **Hesitation:** "Computer: Team / Private" and "Thinking" mean nothing to her.
2. Opens "Model". → First option "Space default ({model name})", then connected models only (`bot-panel.tsx:470-495`). Picks the stronger one. → The Thinking list resets to "Default (Medium)".
3. Clicks "Save". → "Saved" check. **Hesitation:** Name, Title, Description and the Notifications switch save by themselves, but Model, Thinking, Computer, Read replies aloud, Voice and Memory scope save only when she presses "Save". A change followed by closing the panel is lost with no warning (`bot-panel.tsx:392` blur save versus `:628-642` Save button).
4. Types `web_search` in "Disabled tools" and presses Enter. → A row `web_search` with an on switch appears and the change saves immediately (`bot-panel.tsx:326-345,575-618`). Types `weather` and presses Enter. → "Unknown tool" in red.
5. Turns the `web_search` switch off. → Row disappears; the tool is allowed again.

##### Variations
- Model not in the connected list (e.g. a model she disconnected): kept as a plain entry using its id (`bot-panel.tsx:484-490`).
- "Computer" → "Private" changes the bot's computer on Save; no confirmation.

##### Edge Cases
- Save fails: "Could not save" under the fields (`bot-panel.tsx:315`).
- Model list fails to load: the Thinking field is simply missing, with no error (`bot-panel.tsx:181-196`).

#### STORY-APP-162: Maya reads and edits what a bot remembers, and adds a skill

**Type**: medium
**Topic**: Bot settings — memory and skills
**Persona**: Naive first-time founder
**Goal**: "See what Chief remembers about me and fix one fact; teach it how we write investor updates."
**Preconditions**: Chief has two memory documents (MOCK, e.g. `profile.md`, `investors.md`). Bot Settings → Advanced open.
**Ideal path**: 4.
**Alternate paths**: Settings → Memory shows all bots' memory in one list (STORY-APP-188).

##### Steps
1. In Advanced, finds the tabs "Memory" and "Shared skills" (aria-label "Knowledge") (`pages/KnowledgeSection.tsx:36-47`). "Memory" is selected. → Lists documents by path with "rev N", or "Nothing remembered yet".
2. Clicks the row `investors.md`. → A text box opens under it with "Save" (disabled until she changes the text) and "Cancel"; "Download as markdown" is below the list (`KnowledgeSection.tsx:262-321`). Edits one line and clicks "Save". **Hesitation:** She does not know whether the bot reads this file or just stores it.
3. Switches to "Shared skills". → Rows with a "Built-in" or "Plugin" badge, or "No skills yet" (`KnowledgeSection.tsx:471,335`).
4. Clicks "New skill". → A `SKILL.md` text area pre-filled with a template; "Save" is already enabled (`KnowledgeSection.tsx:520-530,575`). **Hesitation:** She can save the untouched template as a skill. She edits the title and instructions, clicks "Save". → Row appears. Typing "/" in Chief's composer now lists it (STORY-APP-153).
5. Opens a built-in skill. → Read-only; the button says "Close" instead of "Cancel" (`KnowledgeSection.tsx:543`).
6. Opens her own skill and clicks "Delete". → The button changes to "Confirm delete"; a second click removes it.

##### Variations
- Failure strings: "Could not load", "Could not save", "Could not save skill", "Could not delete skill".

##### Edge Cases
- Two people edit one memory document: the revision number differs; the panel shows no merge notice. (Not exercised; only one user in the seed.)

#### STORY-APP-163: Maya keeps a to-do list in a bot's "Open work"

**Type**: short
**Topic**: Bot settings — scratchpad
**Persona**: Naive first-time founder
**Goal**: "Leave Chief a short list of things to remember across chats."
**Preconditions**: Chief Settings → Advanced open.
**Ideal path**: 2 — type an item, Add.
**Alternate paths**: Ask Chief in chat to add to its list.

##### Steps
1. Finds "Open work" with "None yet" (`pages/ScratchpadSection.tsx:106-110`). **Hesitation:** She does not know it is the bot's working list, not hers.
2. Types "Send Q3 investor update by Friday" in "Add item" (aria-label "New open-work item", limit 200 characters) and clicks "Add" (or presses Enter). → A row appears with a check box (aria-label "Complete"), the plain word "open" on the right, a "Park" button and an "X" (aria-label "Remove") (`ScratchpadSection.tsx:114-176`). **Hesitation:** The status shows as a raw lowercase word.
3. Ticks the check box. → Title is struck through; the word changes to "done"; the box label becomes "Reopen". The "Park" button disappears.
4. Adds another item and clicks "Park". → Word changes to "parked"; the button becomes "Open".

##### Edge Cases
- Failures: "Could not add", "Could not update", "Could not remove", "Saved, but list refresh failed".

#### STORY-APP-164: Maya checks the numbers strip and the List panel on a bot

**Type**: short
**Topic**: Bot pins — stats strip and List
**Persona**: Naive first-time founder
**Goal**: "See Chief's headline numbers and tick off its checklist."
**Preconditions**: Chief has pins: stats "Runway 14 mo", "Cash $410,000" (MOCK) and a list "MOCK Q3 to-dos" with 3 items.
**Ideal path**: 2.
**Alternate paths**: Ask Chief to update them.

##### Steps
1. Opens Chief. → Cards in a strip under the header, each with label, big value, small detail; a warning icon appears on a failed value; a "Refresh" icon with the tooltip "Updated {time}" (`pages/shell/bot-pins.tsx:40-100`). She clicks "Refresh". → The icon spins until done. Failed refresh shows nothing.
2. Clicks the "List" icon in the header (`pages/Shell.tsx:4283-4297`). → Panel "List" with the list title, items with check boxes, an "Add item" box (`bot-pins.tsx:215-270`). Ticks an item (strikethrough) and clicks an item's text to edit; Enter saves, Escape cancels, blank text removes it.
3. Types "Review hiring plan" in "Add item" and presses Enter. → Appended at the bottom.

##### Variations
- The "List" icon is hidden at wide widths while the panel is closed, because the list shows beside the chat (`Shell.tsx:4293` `xl:hidden`).

##### Edge Cases
- Save fails twice: "Couldn't save. Try again." (`bot-pins.tsx:262`).
- The bot changed the list in the meantime: "The bot changed this list. Your last edit wasn't saved." (`bot-pins.tsx:267`).
- At 50 items the "Add item" box disappears (`BOT_PINS_MAX_ITEMS`, `packages/contracts/src/pins.ts:11`).

#### STORY-APP-165: Maya edits the page her bot keeps

**Type**: short
**Topic**: Bot page panel
**Persona**: Naive first-time founder
**Goal**: "Fix a typo in the notes page Chief writes for me."
**Preconditions**: Chief has a page ("MOCK board prep notes"); header shows a "Page" icon.
**Ideal path**: 2.
**Alternate paths**: none found.

##### Steps
1. Clicks the "Page" icon in the header (`pages/Shell.tsx:4274-4283`). → Right panel "Page" shows a rich text document (headings, lists, tables, tasks, charts).
2. Clicks into a paragraph and fixes a word. → It saves after a short pause, with no indicator (`pages/shell/bot-page-panel.tsx:128-170`). **Hesitation:** She does not know it saved. There is no "Saved" mark.
3. Chief edits the page in the background. → If she has unsaved typing, a "Page changed. Reload" button appears (`bot-page-panel.tsx:216`); otherwise the page updates silently.

##### Edge Cases
- Save fails: "Could not save the page." in red.
- A chart in the page has a hover "Delete chart" button.

#### STORY-APP-166: Maya clears Chief's chat, exports it, and checks what Delete removes

**Type**: short
**Topic**: Bots — clear, export
**Persona**: Naive first-time founder
**Goal**: "Start Chief over without deleting it, and keep a copy."
**Preconditions**: Chief with a long thread. Settings panel open.
**Ideal path**: 3 — Export → Clear conversation → Clear.
**Alternate paths**: "Clear conversation" in the sidebar row menu (`pages/BotContextMenu.tsx:140`).

##### Steps
1. Clicks "Export" at the bottom of Settings (`bot-panel.tsx:645`). → A file `chief-export.json` downloads (`pages/Shell.tsx:4650-4660`). **Hesitation:** No message says it downloaded or what it contains.
2. Clicks "Clear conversation" (red). → Dialog "Clear Chief’s conversation?": "This permanently removes every message and stops current work. The chat remains available." (`pages/shell/dialogs.tsx:362-368`). Clicks "Clear". → Thread empties; the greeting does not return.
3. Looks for whether the bot's memory and settings survive. **Hesitation:** The dialog only says messages are removed; it does not say what else is kept.

##### Edge Cases
- Clear fails: "Could not clear conversation".
- A run in progress is stopped by Clear (dialog text says so).

### Stories: Chief and bot chats

#### STORY-APP-012: Maya asks Chief for this week's priorities with a file attached

**Type**: medium
**Topic**: Chat composer
**Persona**: Naive first-time founder
**Goal**: "Give Chief our board memo and get a short priority list back."
**Preconditions**: Chief works; local file "MOCK DEMO DATA board memo.pdf" (2 MB).
**Ideal path**: 3 — attach, type, send.
**Alternate paths**: Drag the file onto the composer; paste a copied image; for Word and Excel files see STORY-APP-155.

##### Steps
1. Clicks the round "+" at the left of the message bar (aria-label "Attach file", `pages/Shell.tsx:6903`). **Hesitation:** A "+" in a circle suggests "new chat", not "attach". The sidebar "+" also means "new". → Picks the PDF. A chip with a paperclip, the file name and a small "x" (aria-label "Remove MOCK DEMO DATA board memo.pdf") appears above the bar (`Shell.tsx:6753-6790`).
2. Types "What are my top 3 priorities this week based on this?" in the field labelled "Message Chief". Shift+Enter adds a line; Enter sends. → The up-arrow button (aria-label "Send") turns active.
3. Presses Enter. → The message appears right-aligned with the file card. The bar shows a square Stop button (aria-label "Stop", `Shell.tsx:7112-7122`); an animated bot glyph shows "Starting", then "Thinking" or "Writing" (`Shell.tsx:5588-5597`).
4. While Chief streams, scrolls up. → A pill "Jump to latest" appears at the bottom (`Shell.tsx:6086-6096`). Clicks it. → Back at the newest line.
5. Types a second message while the first is still running. → Both the Send arrow and the Stop square are shown (`Shell.tsx:7098-7122`); sending adds another message. The screen does not say whether Chief picks it up now or after the current run.
6. Clicks Stop on a long answer. → The reply stops; Stop is replaced by Send.

##### Variations
- Phone width: the bar keeps Attach, field, Send; the field grows up to about 100 px then scrolls (`Shell.tsx:7078`).
- Her bot is not Chief but a group: the microphone is absent (`Shell.tsx:3224`).

##### Edge Cases
- Send fails: red banner "Failed to send message" with an "x" (aria-label "Dismiss error") above the bar; the draft and the chip stay (`Shell.tsx:2465,6700-6715`).
- Switching to another chat clears the pending chips and the reply target (`Shell.tsx:2943-2956`) and remounts the composer (its `key` is the chat id, `Shell.tsx:3206`), so text she typed but did not send is lost (`useState("")`, `Shell.tsx:6236`). **Hesitation:** She leaves to check the Finance helper and comes back to an empty bar.

#### STORY-APP-013: Maya reacts to, replies to, and copies one of Chief's answers

**Type**: short
**Topic**: Message hover actions
**Persona**: Naive first-time founder
**Goal**: "Thumbs-up the good answer, ask a follow-up on that exact point, and paste it into Slack."
**Preconditions**: Chief thread with 3 assistant messages; one already has 👍.
**Ideal path**: 3 — hover → react; hover → reply; hover → More → Copy.
**Alternate paths**: "Reply" is both a hover icon and an item under "More" (`pages/Shell.tsx:7305-7338`).

##### Steps
1. Hovers an answer. → Three icons appear beside it: smiley ("React"), arrow ("Reply"), dots ("More"), plus the send time (`Shell.tsx:7268-7330`). On a touch screen the buttons are 44 px instead of 28 px (`Shell.tsx:7277`).
2. Clicks "React". → Six emoji: 👍 👎 ❤️ 😂 🎉 😮 (`packages/contracts/src/reactions.ts:3`). Picks 🎉. → A small pill with 🎉 appears under the message (`Shell.tsx:6037-6056`). **Hesitation:** She taps 🎉 again expecting to undo it; the count becomes "🎉 2". There is no way to remove a reaction, and the pills are not buttons.
3. Clicks "Reply". → A preview bar above the field shows who and what she is replying to, with a close "x"; screen readers hear "Replying to Chief" (`Shell.tsx:6368,6678`). Types "Expand on point 2" and sends. → Her bubble shows a quoted line; clicking the quote scrolls to the original.
4. Clicks "More" → "Copy". → The text is on the clipboard, but nothing changes on screen (`Shell.tsx:7258-7262`). **Hesitation:** She clicks twice to be sure.

##### Edge Cases
- Streaming bubbles ("progress") show no actions (`Shell.tsx:7255`).
- Reaction fails: "Could not update reaction" in the composer banner (`Shell.tsx:2287`).
- A reaction does not start a bot run (`apps/api/src/thread-target.ts:1020-1064`); the bot does not "reply" to a 👍.

#### STORY-APP-151: Maya quotes one sentence from a long answer

**Type**: short
**Topic**: Message quote
**Persona**: Naive first-time founder
**Goal**: "Ask about just one line of Chief's long runway answer."
**Preconditions**: Chief reply with several paragraphs ("MOCK DEMO DATA runway is 14 months at the current burn…").
**Ideal path**: 3 — select text → Quote → type → send.
**Alternate paths**: Reply to the whole message (STORY-APP-013).

##### Steps
1. Drags the mouse across "14 months at the current burn" inside one answer. → A floating button "Quote" appears next to the selection (`pages/Shell.tsx:6130-6175`). **Hesitation:** It only appears when the selection is inside one message's text; selecting across two messages shows nothing.
2. Clicks "Quote". → The selection clears and the reply bar above the field shows the quoted text (`Shell.tsx:3114-3117`).
3. Types "Is that before or after the new hire?" and sends. → Her bubble carries the quote; clicking it jumps to the original.

##### Variations
- Selecting text in her own bubble also offers Quote (user bubbles carry the same quote marker, `pages/Shell.tsx:7853`).
- Phone: the button is placed from the selection rectangle; touch behavior was not checked in code.

##### Edge Cases
- Currency hidden by "Hide amounts": the quote text is masked (`Shell.tsx:6726`).
- Window scrolls: the button re-anchors, flips below the selection if there is no room above.

#### STORY-APP-152: Maya taps the microphone, expecting dictation

**Type**: short
**Topic**: Voice call
**Persona**: Naive first-time founder
**Goal**: "Dictate a message to Chief instead of typing."
**Preconditions**: Voice provider not connected (default). Chief chat, empty field.
**Ideal path**: 2 — tap mic, talk. Real path: the mic starts a call, and without a voice provider it opens Settings.
**Alternate paths**: Type instead.

##### Steps
1. Sees a microphone button (aria-label "Voice") at the right end of the bar while the field is empty (`pages/Shell.tsx:7084-7098`). Clicks it. → Settings opens on "Voice" (`Shell.tsx:3227-3230`) with the providers list ("Providers", each "Speak + transcribe" or "Speak only"). **Hesitation:** She expected to start talking; instead she is asked to choose a provider and paste an API key.
2. Continues in STORY-APP-189 to connect a provider. Closes Settings and clicks the mic again. → A call card appears: "On a call with Chief" with buttons Settings, Transcript, Mute/Unmute, Hang up (`components/call/CallCard.tsx:40-110`).
3. After "Hang up", the chat shows a "Voice chat" card with "Show transcript" / "Hide transcript" (`components/call/VoiceChatCard.tsx:39-49`).

##### Variations
- A provider marked "Speak only" has `transcribe: false` passed to the call (`lib/call-session.ts:105-109`). Whether the call card tells her it cannot hear her was not found in `CallCard.tsx`.
- As soon as she types a character, the microphone disappears and Send takes over (`Shell.tsx:7084`).

##### Edge Cases
- Group chats have no microphone.

#### STORY-APP-153: Maya types "/" and finds Chief's skills and Settings shortcuts

**Type**: short
**Topic**: Chat composer — slash picker
**Persona**: Founder who uses Slack and expects "/" commands
**Goal**: "Open settings without leaving the keyboard; use the skill my engineer added."
**Preconditions**: One shared skill "MOCK Investor update" exists (STORY-APP-162).
**Ideal path**: 2 — type "/", pick.
**Alternate paths**: Clicking the chat title or her name in the sidebar.

##### Steps
1. Types "/" as the first character. → A list opens above the bar: skills ("Skill MOCK Investor update" with a one-line description) then "Chat Settings", "Settings: General", "Settings: Usage" (`pages/Shell.tsx:6849-6880`, `packages/core/src/composer-slash.ts:1-5`). **Hesitation:** Nothing on screen tells her "/" exists.
2. Types "usage". → Only "Settings: Usage" stays. Clicks it. → Settings opens at Usage; the field is cleared.
3. Types "/inv" and picks the skill. → A chip "MOCK Investor update" with an "x" (aria-label "Remove skill …") appears in the field; she adds text and sends.
4. Presses Backspace on an empty field. → The chip is removed (`Shell.tsx:6990-6995`).

##### Edge Cases
- "/" typed after other text does nothing; it only works at the start (`Shell.tsx:6398`).
- The field's key handler wires arrow keys and Enter for the @ list only; the "/" list has no key handling there (`pages/Shell.tsx:6905-7060`). Enter sends the text "/usage" as a message.

#### STORY-APP-154: Maya presses the Up arrow to resend an earlier question

**Type**: short
**Topic**: Chat composer — history
**Persona**: Founder who uses a terminal
**Goal**: "Send the same weekly question again with one small change."
**Preconditions**: She sent "What did we spend on cloud last month?" earlier in this chat.
**Ideal path**: 2.
**Alternate paths**: Copy from the earlier bubble.

##### Steps
1. Clicks into the empty field and presses Up. → The last message she sent appears in the field with the caret at the end (`pages/Shell.tsx:6378-6389,7020-7040`). **Hesitation:** Nothing hints at this.
2. Presses Up again. → An older message. Presses Down → newer, and finally her empty draft.
3. Edits "last month" to "this quarter" and presses Enter.

##### Edge Cases
- Up only starts from an empty field; with text in it, Up moves the caret as usual (`Shell.tsx:7041-7048`).
- Typing any character leaves recall mode (`Shell.tsx:6391-6393`).
- Suspected defect: the history is built from every user message in the thread (`Shell.tsx:1989-1999`). A reaction is stored as a user message with the emoji as its text (`apps/api/src/thread-target.ts:1046`), so Up can recall "🎉" or "👍" in place of a real question. Not run; confirm in a browser.

#### STORY-APP-155: Maya attaches five files, a Word file and a huge PDF

**Type**: medium
**Topic**: Chat attachments — limits
**Persona**: Naive first-time founder
**Goal**: "Give Chief everything for the board pack in one go."
**Preconditions**: Files from the seed: board memo.pdf (2 MB), cap table.xlsx, deck.docx, raw export.pdf (14 MB), five PNG screenshots.
**Ideal path**: 3 — pick all, send.
**Alternate paths**: Add the documents to the Data room and ask Chief to use them.

##### Steps
1. Clicks "Attach file". → The system picker only offers images, PDF, text, Markdown, CSV, HTML, JSON and ZIP; `.docx` and `.xlsx` are greyed out in most pickers (`pages/Shell.tsx:376,6895`). **Hesitation:** She wonders why her Word deck cannot be selected and sees no explanation.
2. Selects the PDF, the 14 MB PDF and five PNGs anyway. → Chips appear for the first 4 acceptable files (the memo and three screenshots). A yellow notice appears: "Skipped MOCK DEMO DATA raw export.pdf (over 10 MB), MOCK screenshot 4.png (max 4 attachments), MOCK screenshot 5.png (max 4 attachments)" with a dismiss "x" (`Shell.tsx:2292-2322`).
3. Drops "MOCK DEMO DATA deck.docx" onto the bar. → Notice: "Skipped MOCK DEMO DATA deck.docx" with no reason (`Shell.tsx:2305-2312`). **Hesitation:** The notice says what was skipped, not why, for unsupported types.
4. Removes a PNG chip with its "x", then adds a skipped screenshot. → It is accepted, because the limit counts current chips only.
5. Sends. → The files upload and appear as cards in her message; a failed send shows "Failed to send message".
6. Drags the Word file onto the main chat area outside the bar. → A full-window overlay "Drop to add to Data room" appears and the file is uploaded to the Data room with a toast, not attached to the chat (`components/data-room/DropZone.tsx:55-60,118-125`). **Hesitation:** Two drop targets look the same; the composer shows a ring, the rest of the window shows the Data room overlay.

##### Variations
- Pasting a screenshot (Cmd+V in the field) adds it as a chip (`Shell.tsx:6569-6585`).
- Phone: the picker opens the camera roll and files app.

##### Edge Cases
- Dropping a folder or a file with no extension and no known type is skipped by name only.

#### STORY-APP-156: Maya turns on tool activity to see what Chief is doing

**Type**: medium
**Topic**: Tool activity disclosure
**Persona**: Naive first-time founder
**Goal**: "Find out why a simple question takes two minutes."
**Preconditions**: Chief runs a task that uses 5+ tools (e.g. "Check our Gmail for investor replies this week").
**Ideal path**: 3 — Settings → Advanced → Show tool activity.
**Alternate paths**: Activity view in the sidebar shows run states, not steps (part A).

##### Steps
1. Sends the request. → Chief shows only the answer text and a status line ("Using Gmail search" etc.). No steps are visible. **Hesitation:** She sees "Using …" in the status line but no list; tool cards are hidden by default (`lib/tool-activity-preference.ts:35-37`).
2. Settings → General → "Advanced" → switch "Show tool activity" on (`pages/AccountSettingsOverlay.tsx:276-295`). Closes Settings.
3. Sends the same request again. → While running, a line "Working… · 3 tools" with a chevron is open, listing the last 6 steps with a ◷ on the current one and "+2 earlier steps" above (`components/ToolActivityDisclosure.tsx:12,62-105`).
4. When the run ends, the card folds to "Done · 7 tools · 1m 42s". She clicks it. → Each step shows a ✓ and a label, with "×3" for repeats (`ToolActivityDisclosure.tsx:46-52`).

##### Variations
- A message with tools only and no text appears as a plain muted line between bubbles instead of a bubble (`StandaloneToolActivity`).
- The setting is stored per browser, not per account (`localStorage` key `rakazo.showToolActivity`), so a second computer shows no tools.

##### Edge Cases
- A manual collapse during a run holds until the run ends (component comment).
- Setting off again hides the cards but not the status line.

#### STORY-APP-157: Chief asks before doing something, and later asks for a password

**Type**: medium
**Topic**: Approvals and questions in chat
**Persona**: Naive first-time founder
**Goal**: "Let Chief act, but only with my OK on the risky part."
**Preconditions**: Chief is allowed to use a tool that needs approval; a task that will ask a question ("Which account should I pay from?").
**Ideal path**: 2 — read the card, press one button.
**Alternate paths**: Rules in Settings → Advanced → Action confirmations (STORY-APP-158); email approvals use the mail card (prior STORY-031..033).

##### Steps
1. Asks Chief to "Pay the MOCK Cloud invoice". → A card (not a bubble) appears with the question text, optionally a grey code box with details, and full-width buttons "Allow once" (highlighted), "Always allow this tool", "Deny" (`components/AskCard.tsx:36-40,147-165`). A notification may arrive if she is in another tab (STORY-APP-016). **Hesitation:** "Always allow this tool" sounds permanent and she cannot tell how to undo it.
2. Clicks "Allow once". → Buttons are replaced with the green line "Allowed once" (`AskCard.tsx:25`). Chief continues.
3. Chief asks "Which account should I pay from?" with a text field "Type your answer" and "Send answer". → She types "Operating" and sends; the card shows "Answered".
4. Chief needs a login password. → A card with a masked field labelled "Password" and a "Save" button; the card shows where it will be used (a site or a command variable) (`AskCard.tsx:105-120,165-190`). She types it and clicks "Save". → "Saved". The text is never shown in chat.
5. Scrolls up to an older card she skipped. → It says "No longer active" with no buttons (`AskCard.tsx:133`).

##### Variations
- "Deny": Chief explains it did not proceed.
- The card answered on another device flips to its answered state.

##### Edge Cases
- Submit fails: "Could not submit this answer".
- Only the newest question is answerable (`latestAnswerableAskMessageId`, `pages/Shell.tsx:2012`).

#### STORY-APP-158: Maya makes Chief always ask before sending email

**Type**: short
**Topic**: Settings — action confirmations
**Persona**: Cautious first-time founder
**Goal**: "Never let a bot email an investor without my OK."
**Preconditions**: Settings open.
**Ideal path**: 3 — General → Advanced → "Ask before sending external email".
**Alternate paths**: Answer each approval card as it comes (STORY-APP-157).

##### Steps
1. Settings → General, scrolls to the bottom, clicks "Advanced". → Opens a section "Action confirmations" with two buttons "Ask before sending external email" and "Ask before purchases", a switch "Flag unexpected actions", and a list of rules (`components/ApprovalRulesSettings.tsx:111-190`). **Hesitation:** These look like actions to run, not settings; she cannot tell if the button is on.
2. Clicks "Ask before sending external email". → A row "Ask before email actions" with "Remove" appears.
3. Clicks the same button again. → Nothing happens, and no message (`ApprovalRulesSettings.tsx:46-58`).
4. Turns on "Flag unexpected actions". → If no model is available: "Add a model in Settings to use this." (`ApprovalRulesSettings.tsx:140`).
5. Clicks "Remove" on the rule. → The row goes away. The screen does not say whether the bot then asks or sends by default.

##### Edge Cases
- Load fails: "Could not load approval rules". Save fails: "Could not save rule".

#### STORY-APP-014: Maya works with a burn table Chief produced

**Type**: short
**Topic**: Chat tables
**Persona**: Naive first-time founder
**Goal**: "Sort by amount and get it into a spreadsheet."
**Preconditions**: Chief message with a Markdown table of 14 rows (Category, Amount, Change).
**Ideal path**: 2 — click the Amount header; Download.
**Alternate paths**: "Copy rows" then paste into Sheets.

##### Steps
1. Clicks the "Amount" header (aria-label "Sort by Amount"). → Sorted; clicking again reverses; a third click clears (`packages/chat-ui/src/markdown-table.tsx:122-135`).
2. Reads the footer "1–10 of 14 rows" with Previous page and Next page icons (`markdown-table.tsx:186-215`).
3. Clicks the expand icon (aria-label "Expand table"). → A larger dialog with all rows and a "Close table" icon (`markdown-table.tsx:245-262`).
4. Clicks "Copy rows". → The icon becomes a check for 1.5 s (`markdown-table.tsx:155-166,232`). Pastes into a sheet: tab-separated, in the sorted order.
5. Clicks "Download CSV". → A file `table.csv` downloads (`markdown-table.tsx:178`). **Hesitation:** A second table also downloads as `table.csv`; the browser renames it "table (1).csv".

##### Edge Cases
- All table labels are fixed English (`markdown-table.tsx:196-262`), even when Language is Español (STORY-APP-184).
- Less than 10 rows: no paging, footer "N rows".

#### STORY-APP-015: Maya hands work to the Leadership group with @ from Chief's chat

**Type**: short
**Topic**: Chat — mention a group
**Persona**: Naive first-time founder
**Goal**: "From Chief's chat, ask the Leadership group to review the deck."
**Preconditions**: Leadership group exists; Chief chat open.
**Ideal path**: 3 — type @Lead, pick, add text, send.
**Alternate paths**: Open the group from the sidebar and type there.

##### Steps
1. Types "@Lead". → A list (aria-label "Mentions") shows "Leadership" with subtitle "Group", and other bots, routines and apps that match (`pages/Shell.tsx:6790-6830`, `packages/core/src/composer-mentions.ts:196-251`). **Hesitation:** The list mixes people-like items and apps; subtitles "Bot", "Group", "Runs on send · …", "Connected" are small.
2. Presses Enter to pick. → A chip is added in the field. Types "please review the deck" and sends. → The message is delivered to the group, and Chief's chat does not show it. A line under the chat says "Sent to Leadership" with an "Open" link (`Shell.tsx:3178-3197`).
3. Clicks "Open". → Goes to `/app/g/<id>`.

##### Variations
- Chip only, no text, Enter: the group opens without sending anything (`composer-mentions.ts:284-298`).
- If she was replying to a Chief message, the reply link is dropped on reroute (`Shell.tsx:2418`). **Hesitation:** "Where did my reply go?"
- No match: "No matches. Press Escape to send as typed." (`Shell.tsx:6839`).

##### Edge Cases
- The notice disappears after a few seconds (`Shell.tsx:391`).

#### STORY-APP-171: Maya mentions a routine and an app in one message

**Type**: medium
**Topic**: Chat — routine and app mentions
**Persona**: Naive first-time founder
**Goal**: "Run my Monday cash check now, and use Slack."
**Preconditions**: Routine "MOCK Monday cash check" exists (STORY-APP-172); Slack connected; Gmail shown as "Needs sign-in" in the picker.
**Ideal path**: 3.
**Alternate paths**: Open the routine in the bot panel and click "Test run".

##### Steps
1. Types "@Mon". → The list shows "MOCK Monday cash check" with the subtitle "Runs on send · Weekdays at 08:00" (`composer-mentions.ts:235-246`). Picks it. → A chip with the label "Runs on send" (`pages/Shell.tsx:6951-6954`).
2. Presses Enter with no text. → The routine starts at once, nothing is posted to chat, and a run starts for its bot (`Shell.tsx:2362-2380`). No confirmation line is shown (`Shell.tsx:2362-2380`).
3. Types "@Slack" and adds "post the summary to #finance". → A chip "Slack". Sends. → The bot receives the message with the app named.
4. Types "@Gmail" for an app not yet signed in. → The chip shows "Needs sign-in"; the message goes out with the line "Use these connectors if relevant: Gmail." added (`composer-mentions.ts:123-140`).

##### Edge Cases
- Routine fails to start: the failure message shows in the composer banner.
- Two routines with one name: the subtitle adds the bot name.

#### STORY-APP-016: Maya wants to know when Chief is done or needs her

**Type**: short
**Topic**: Notifications
**Persona**: Naive first-time founder
**Goal**: "Ping me when the long task finishes, and show me what needs me."
**Preconditions**: Chief with Notifications on (default for new bots); browser permission "default".
**Ideal path**: 2 — allow once; click the notification.
**Alternate paths**: Per-bot "Notifications" switch in Settings (`pages/shell/bot-panel.tsx:424-440`).

##### Steps
1. Sends a long request. → The browser asks for notification permission now, on the first send to a bot with notifications on (`pages/Shell.tsx:2358-2362`). **Hesitation:** No explanation precedes the prompt.
2. Allows; switches tab. → When Chief finishes a notification appears titled "Chief finished" with the body "Finished." (or "{name} failed", "{name} stopped"; a new message shows its text under the bot name) (`lib/browser-notifications.ts:72-104`).
3. Clicks the bell in the sidebar (title "Activity"). → The list shows "Needs you", "Working", "Finished" sections and "Nothing needs you right now." when empty; "Search runs", "Status", "From", "To" and "Reset all" filters (`pages/ActivityList.tsx:119-370`).
4. Opens Chief's Settings and turns "Notifications" off.

##### Edge Cases
- Permission denied once: there is no in-app way to ask again.

### Stories: Group chats, peer messages and chat failures

#### STORY-APP-168: Maya talks to a group and only one bot answers

**Type**: medium
**Topic**: Group chat replies
**Persona**: Naive first-time founder
**Goal**: "Ask both the Finance helper and Chief for a view."
**Preconditions**: Leadership group (Chief first, MOCK Finance helper second).
**Ideal path**: 3 — message, then mention who should answer.
**Alternate paths**: `@everyone` (group only).

##### Steps
1. Sends "Should we hire two more engineers this quarter?" with no names. → Only the first member (Chief) answers (`packages/core/src/group-mentions.ts:52-54`). **Hesitation:** The group dialog promised "They all reply in the same thread". She waits for the Finance helper.
2. Types "@MOCK Finance helper what does that do to runway?" → The list shows each member plus "everyone" ("Everyone in this group", `composer-mentions.ts:207-215`). Picks the helper and sends. → The helper answers, with its name and avatar above the bubble.
3. Types "@everyone summarize in two lines". → Every member replies, one after the other.
4. Clicks the group name → "Group settings", removes Chief, adds "MOCK Hiring helper", clicks "Save". → Panel closes; members change. Past messages stay.

##### Variations
- Typing a name without picking a chip also counts (`hasMentionToken`), but a name written differently from the bot's does not; the first member answers.
- A bot "handed off to" another: a centered line "Chief handed off to MOCK Finance helper" appears (`pages/Shell.tsx:7640-7655`).

##### Edge Cases
- A group needs 2–6 members; saving with 1 is disabled with no message.
- Every group member must be non-archived (`GroupPanel.tsx:30`).

#### STORY-APP-167: Maya opens the conversation between Chief and the Finance helper

**Type**: medium
**Topic**: Peer messages
**Persona**: Naive first-time founder
**Goal**: "See what Chief asked the Finance helper behind my back."
**Preconditions**: Chief's thread has a marker "Messaged MOCK Finance helper" (a bot-to-bot message).
**Ideal path**: 2 — click the marker.
**Alternate paths**: Open the Finance helper's own chat.

##### Steps
1. Sees a small centered marker with two colored dots: "Messaged MOCK Finance helper" (or "Message from …") (`pages/Shell.tsx:7655-7670`, `components/ai/CollaborationMarker.tsx`). **Hesitation:** It looks like a label, not a button.
2. Clicks it. → A full-screen dialog titled "Chief · MOCK Finance helper" with sent and received bubbles, each labelled with the sender's name (`pages/PeerMessagesOverlay.tsx:68-145`).
3. Reads the bottom line "This chat is view-only" (`PeerMessagesOverlay.tsx:149`). **Hesitation:** She wants to answer on the helper's behalf; there is no box.
4. Clicks "Close".

##### Variations
- Loading: "Loading…"; empty: "No messages with MOCK Finance helper yet."
- Phone: the dialog fills the screen.

##### Edge Cases
- Load failure: "Could not load this chat." with "Retry now".

#### STORY-APP-169: Chief creates a helper bot and a card appears in chat

**Type**: short
**Topic**: Child bot card
**Persona**: Naive first-time founder
**Goal**: "Ask Chief to set up a bot that tracks vendor invoices."
**Preconditions**: Chief can create bots.
**Ideal path**: 2 — read the card, click it.
**Alternate paths**: Find the bot in the sidebar.

##### Steps
1. Asks "Create a bot that tracks vendor invoices." → A card in the chat shows the new bot's name, a green tag "bot", and its title or "Opened its thread." (`pages/Shell.tsx:7752-7790`).
2. Clicks the card. → Opens the new bot's chat.
3. Later the bot is archived: the tag turns red "archived" with "Archived. Chat, memory, and files kept." and the card is disabled. If deleted: "deleted" and "Removed with chat, computer, and memory."

##### Edge Cases
- The new bot may carry a "computer" card with its own "Open" button (`Shell.tsx:7973-7995`).

#### STORY-APP-170: Maya's message fails to send, and a Stop does not work

**Type**: short
**Topic**: Chat failures
**Persona**: Naive first-time founder on weak Wi-Fi
**Goal**: "Send a message when the connection drops and recover."
**Preconditions**: Server blocks the next send (stub).
**Ideal path**: 2 — read the banner, resend.
**Alternate paths**: Wait for the app to reconnect.

##### Steps
1. Sends "Update the investor list." → Red banner above the bar: "Failed to send message" with an "x" ("Dismiss error"); the typed text and chips remain (`pages/Shell.tsx:2465,6700-6715`).
2. Presses Send again. → Goes through with the same message id, so nothing duplicates (retry nonce, `Shell.tsx:6516`).
3. While Chief runs, clicks Stop and the server rejects it. → Banner "Failed to stop" (`Shell.tsx:2501`). Stop stays.
4. Dismisses the banner. → Focus returns to the field.

##### Edge Cases
- A run error from the bot (not the send) uses the same banner with the bot's message.

### Stories: Routines

#### STORY-APP-172: Maya sets up a Monday cash check that runs by itself

**Type**: long
**Topic**: Routines — create, test, review
**Persona**: Naive first-time founder; she calls it "a reminder that does the work"
**Goal**: "Every weekday at 8 AM, have Chief tell me what is in the bank and flag bills due this week."
**Preconditions**: Chief exists and works; Gmail/Finance optional; no routines yet.
**Ideal path**: 6 — Chief → Bot computer icon → Routines "+" → fill name and instruction → Add trigger → Save.
**Alternate paths**: Tell Chief in chat to "run this every weekday at 8"; a teach recording can end with "Add to routine" (`components/teach/SkillDraftCard.tsx:150`).

##### Steps
1. Looks for "Routines" in the sidebar and the settings panel and finds nothing. Clicks the monitor icon in Chief's header (title "Bot computer", `pages/Shell.tsx:4299-4316`). → The right panel shows a screen preview of the bot's computer and, below it, a heading "Routines" with a small "+" (title "Create Routine", `pages/RoutineEditor.tsx:145-160`). **Hesitation:** Routines live under the computer picture. Nothing in Settings or the sidebar points there.
2. Clicks "+". → Panel "Routine": back arrow, an "Active" switch (on), "Delete", "Test run" (disabled until saved), "Name" ("Name this routine"), "Instruction" ("What should this routine do each time it runs?"), a "When to run" line with her timezone and a sliders icon (aria-label "Advanced"), a full-width "Add trigger" button, and "Save" (disabled) (`RoutineEditor.tsx:300-625`). A hint reads "Add a schedule, webhook, GitHub, or message trigger to run this routine." **Hesitation:** "Trigger" and "Instruction" are new words; the blank Save button is grey without a reason beyond the hint.
3. Types Name "MOCK Monday cash check" and Instruction "Look at our bank balance and any bills due in the next 7 days. Give me three bullets."
4. Clicks "Add trigger" → "On a schedule" → "Weekdays". → A schedule card "Weekdays at 9:00 AM" with a "How often" select and a time select (`pages/RoutineSchedule.tsx:215-285`, default time `packages/core/src/cron.ts:65`). Changes the time to 8:00 AM. The "Save" button turns on.
5. Clicks "Save". → The panel stays open; "Test run" is now enabled and a "Run history" section with "No runs yet" appears below (`RoutineEditor.tsx:618-640`, `pages/RoutineRunHistory.tsx:168-190`). **Hesitation:** There is no "Saved" message; the new button state is the only sign.
6. Clicks "Test run". → The button reads "Running…" and Chief's chat starts a run (`pages/Shell.tsx:4817-4837`). If she goes Back to the list while it runs, the row shows a "Running · Stop" pill.
7. When done, opens "Run history". → A row with date, the status word, duration, and a "View chat" link that opens `/app/<chief>?m=<message>` at the routine's answer (`RoutineRunHistory.tsx:195-228`).
8. Clicks the back arrow. → The list shows "MOCK Monday cash check" with its schedule summary under the name (`RoutineEditor.tsx:130-141`).
9. Back in chat, types "@Mon" to run it on demand (STORY-APP-171).

##### Variations
- Leaves Name and Instruction blank and presses Save: it saves with the name "Routine" and the instruction "Check in." (`pages/Shell.tsx:4760-4761`). **Hesitation:** She did not choose either.
- Phone width: the panel overlays the chat full width (`ResizableSidePanel.tsx:81`).
- Interval schedule: "every [5] [minutes]" selects with amounts 1, 2, 3, 5, 10, 15, 30, 45 (`cron.ts:68`).
- "Advanced": a cron text box (placeholder `*/3 * * * *`).

##### Edge Cases
- Save fails: "Could not save routine". A schedule-less save is blocked with "Add a schedule, webhook, GitHub, or message trigger" (`Shell.tsx:4716`).
- Test run fails: "Could not run routine".
- Run history fails to load: "Could not load run history"; "Refresh" and "Load older runs" buttons.

#### STORY-APP-173: Maya wants the routine to start when a Slack message arrives

**Type**: medium
**Topic**: Routines — other triggers and model
**Persona**: Naive first-time founder
**Goal**: "When someone posts in #payments, have the Finance helper look at it."
**Preconditions**: MOCK Finance helper Bot computer panel open. Variation A: Slack messaging enabled on the server. Variation B: not enabled.
**Ideal path**: 4.
**Alternate paths**: Webhook or Git event for developer-style triggers.

##### Steps
1. Routines "+" → "Add trigger". → The menu lists "On a schedule", "Slack message", then greyed "Teams message" (tooltip "Teams not enabled"), "Linear issue", "Sentry alert", "PagerDuty incident" (tooltip "Coming soon"), "Git event", "Webhook" (`RoutineEditor.tsx:77-83,550-610`). **Hesitation:** Four greyed items clutter the list.
2. Variation B: "Slack message" is greyed with the tooltip "Slack not enabled"; nothing says how to enable it (`RoutineEditor.tsx:567-580`). She gives up and picks "On a schedule".
3. Variation A: picks "Slack message". → A card "Slack message" with "Runs when this bot receives a verified message from this provider." (`RoutineEditor.tsx:636-660`).
4. Clicks the sliders icon beside "When to run" (aria-label "Advanced"). → A popover with "Model" ("Bot's model" by default) and, when the model supports it, "Thinking". Picks a cheaper model. → A small dot appears on the icon. Saves.
5. Adds "Webhook" instead. → A card "When a webhook fires" with "POST to" (shown after save), "key" ("Available after the routine is saved"), "header" (`RoutineEditor.tsx:700-760`). After Save the key appears once; later it reads "Saved. Rotate to reveal." with a "Rotate key" link. **Hesitation:** If she does not copy the key now, it is hidden.

##### Edge Cases
- "Git event" cards show `X-Hub-Signature-256: sha256=…` and the bot's `/github` address immediately.
- Removing a trigger with the "x" before saving discards it.

#### STORY-APP-174: Maya pauses, stops, and deletes a routine

**Type**: short
**Topic**: Routines — manage
**Persona**: Naive first-time founder
**Goal**: "Stop the Monday check for the holidays, and delete the test one."
**Preconditions**: Routines "MOCK Monday cash check" and "MOCK test routine" exist.
**Ideal path**: 2 per routine.
**Alternate paths**: none found.

##### Steps
1. Opens "MOCK Monday cash check" from the Routines list and turns off "Active". Clicks "Save". → The list row shows a pause icon and the text "Paused" (`RoutineEditor.tsx:133`).
2. Starts "Test run" on a long routine, clicks the back arrow, and clicks the "Running · Stop" pill on the row. → The run stops (`RoutineEditor.tsx:196-208`).
3. Opens "MOCK test routine", clicks "Delete". → Dialog "Delete MOCK test routine?" "This cannot be undone." with Cancel and Delete (`pages/Shell.tsx:5229-5243`, `dialogs.tsx:508-540`). After deleting, the panel returns to the computer view..

##### Edge Cases
- "Active" off but not saved: leaving the panel drops the change.
- A one-shot schedule (specific date) that has never run shows a required "Run at" date-time box; leaving it blank gives "Add a run time for this one-shot."; a past time gives "Run time must be in the future." (`Shell.tsx:4745-4756`).

### Stories: Integrations

#### STORY-APP-176: Maya connects Slack from "Find an app"

**Type**: medium
**Topic**: Integrations — connect an app
**Persona**: Naive first-time founder
**Goal**: "Let my assistants read our #finance channel."
**Preconditions**: App catalog set up; Slack not yet connected; pop-ups allowed.
**Ideal path**: 4 — Integrations → search Slack → Connect → sign in → Continue.
**Alternate paths**: Chief's connect card in chat (part A STORY-APP-001); `@Slack` mention (STORY-APP-171).

##### Steps
1. Clicks "Integrations" at the bottom of the sidebar. → Page "Integrations": "Connect the apps you use so your bots can read and act in them. You choose which bots get access to each one." Sections: "Connected", "Find an app" (search box "Search apps" and category chips All, Email & calendar, Chat, Docs & files, Finance, Developer, Sales & CRM), "Popular", "Finance", "Social", "Equity", "Tools", "Anything else" (`components/integrations/IntegrationsHome.tsx:462-720`). **Hesitation:** Eight sections on one scroll; her app might be in any of them.
2. Types "slack" in "Search apps". → Tile "Slack" with a "Connect" button. Clicks it. → Dialog "Connect Slack" with Cancel and Connect (`ConnectAppDialog.tsx:222-243`).
3. Clicks Connect. → "Step 1 of 3 · Sign in to Slack in the new window. Choose the account to connect, then come back here." with a spinner (`SignInStep.tsx:33-47`). A browser window opens; she signs in to the MOCK workspace and approves.
4. Dialog moves to "Step 2 of 3 · Which bots can use Slack? You can change this later." with every bot checked and "Skip" / "Continue" (`AgentStep.tsx:26-69`). **Hesitation:** All bots start checked, including the Hiring helper, so Continue gives all of them Slack. Clicking Continue is the fast but broad choice.
5. Unchecks MOCK Hiring helper and clicks Continue. → "Slack connected · {workspace} is ready." with ticks "The bots you chose can use Slack." and "Slack now appears under Connected." and "Done" (`ConnectAppDialog.tsx:268-300`). There is no Step 3 label.
6. Clicks "Done". → The Slack card is now under Connected with the account name and "Connected" and a small stack of bot avatars labelled "Used by".

##### Variations
- Pop-up blocked: "Your browser blocked the sign-in window" and "Allow pop-ups for this site, or open the sign-in page directly." with "Open sign-in" (`SignInStep.tsx:80-104`).
- She closes the sign-in window: after a moment "If you closed the sign-in window, try again." with "Try again".
- Catalog not set up and she is not the owner: banner "App connections aren't set up on this server yet. Custom connections still work. Ask the server owner to set up the app catalog." (`IntegrationsHome.tsx:545-556`).

##### Edge Cases
- Sign-in denied or times out: "Sign-in did not finish in time." / "{app} did not accept the sign-in." and "Try again" on the card (`IntegrationsHome.tsx:225-233`).
- "Could not load the app list. Reload to try again."

#### STORY-APP-177: Maya limits Gmail to the Finance helper

**Type**: short
**Topic**: Integrations — which bots can use an app
**Persona**: Naive first-time founder
**Goal**: "Only Chief and the Finance helper should see my mail."
**Preconditions**: Gmail connected; three bots.
**Ideal path**: 2.
**Alternate paths**: The "Continue" step of the connect dialog.

##### Steps
1. Integrations → Gmail card (shows `maya@northwind.example`, "Connected", "Open Inbox", and "Used by" avatars). Clicks the card. → App page with "Accounts", "Add another account", "Used by", "Tools · n" (`components/integrations/AppDetail.tsx:296-360`).
2. In "Used by" turns off the switch for MOCK Hiring helper (aria-label "MOCK Hiring helper can use Gmail"). → Saves at once (`AppDetail.tsx:178-195`). The card's avatar stack drops one.
3. Opens "Tools · 14" and reads "Read — Never changes your account" and "Write — Changes your account".

##### Edge Cases
- Failure: "Could not update bot access".
- Access is per app, not per account (comment at `AppDetail.tsx:183`): two Gmail accounts share one bot list.

#### STORY-APP-017: Maya disconnects her old Gmail address and removes Slack

**Type**: medium
**Topic**: Integrations — remove or disconnect
**Persona**: Naive first-time founder
**Goal**: "Stop the assistants reading my old inbox."
**Preconditions**: Gmail has two accounts (`maya@northwind.example`, `old-maya@northwind.example`); Slack has one.
**Ideal path**: 3 — Gmail page → "Remove account" on the old one → confirm.
**Alternate paths**: "Disconnect Gmail" removes both; Slack uses the same page.

##### Steps
1. Integrations → Gmail. → "Accounts" lists both with "Connected {date}", "Rename" and "Remove account" (`AppDetail.tsx:60-112`).
2. Clicks "Remove account" on `old-maya@`. → Dialog "Remove old-maya@northwind.example?": "Bots lose access to this account.", "Mail data from this account that Praci cached is removed.", "Your data in Gmail is not deleted." (`AppDetail.tsx:404-420`). Confirms "Remove". → Only one account row left.
3. Notices a red "Disconnect Gmail" button at the bottom with "Removes the account and bot access." now that one account is left (`AppDetail.tsx:386-397`). **Hesitation:** With two accounts it said "Removes all 2 accounts and bot access." She misread it as the same as "Remove account".
4. Goes to Slack → "Disconnect Slack" → dialog "Disconnect Slack?" "Every bot loses access to Slack." "Your data in Slack is not deleted." (`AppDetail.tsx:424-445`). Confirms. → Back at Integrations; Slack is gone from Connected.
5. If it was Gmail: the dialog adds "The Inbox page stops showing new mail until you reconnect." (`AppDetail.tsx:438`). The Inbox page later shows its connect state.

##### Variations
- Removing from the Connected list: custom "Remove" on a manual source card shows "Remove {name}?" "Bots lose access to its tools." (`IntegrationsHome.tsx:744-766`).

##### Edge Cases
- Failure: "Could not disconnect" / "Could not remove connector".
- After the last account is removed the page returns to Integrations (`AppDetail.tsx:203`).

#### STORY-APP-018: Maya adds the docs server her engineer sent her

**Type**: medium
**Topic**: Integrations — custom connection
**Persona**: Naive founder forwarding an engineer's instruction ("add this URL")
**Goal**: "Let Chief read our internal docs."
**Preconditions**: URL `https://mcp.mock-northwind.example/mcp` (MOCK stub that accepts OAuth sign-in); Variation B: stub requires a bearer token `mock-token-123`.
**Ideal path**: 3 — Add custom connection → paste URL → Connect.
**Alternate paths**: Settings → Server integrations → "Add server URL" (STORY-APP-019).

##### Steps
1. Scrolls to the bottom, "Anything else": "Add a custom connection — Connect any app that offers an MCP server URL." (`IntegrationsHome.tsx:698-712`). **Hesitation:** "MCP" is unexplained, but the engineer's note used it.
2. Clicks "Add custom connection". → Dialog "Add a custom connection": "Paste the MCP server URL from the app's documentation." with "Server URL" (placeholder `https://example.com/mcp`) and an "Advanced" disclosure (`components/integrations/CustomConnectionDialog.tsx:465-500`).
3. Pastes the URL and clicks "Connect". → Dialog switches to the sign-in step ("Sign in to … in the new window"). She signs in. → Step "Which bots can use …?" with all bots checked; Continue. → "{name} connected".
4. Variation B (token): opens "Advanced", types `mock-token-123` in "Token" ("Only if the server does not use sign-in"), clicks "Connect". → The sign-in step is skipped and she goes straight to choosing bots (`CustomConnectionDialog.tsx:255-262`).
5. Opens the new card on Integrations. → Page shows "via MCP · mcp.mock-northwind.example" with "Reconnect", "Disconnect sign-in", "Rename", "Used by", and "Remove {name}" (`McpDetail.tsx:134-225`).
6. Asks Chief "What does our onboarding doc say about laptops?" → Chief calls the server's tools.

##### Variations
- Wrong text: "Enter the server URL, starting with https://." (`CustomConnectionDialog.tsx:266`).
- Server needs a client ID: the dialog shows "Client ID", "Client secret (optional)" and a "Callback URL" with Copy; message "This server needs an OAuth client ID." (`CustomConnectionDialog.tsx:193,500-540`).
- Unreachable address: the half-created entry is removed and she sees "Could not reach {host}. Check the address and try again." (`CustomConnectionDialog.tsx:205`).

##### Edge Cases
- Sign-in not finished: the entry stays, tagged "Needs reconnect": "{name} was added and shows Needs reconnect until you sign in." (`CustomConnectionDialog.tsx:145`).
- The connection is deleted elsewhere while the page is open: "This connection no longer exists." (`McpDetail.tsx:44`).

#### STORY-APP-178: Maya finds Carta, X, Zernio and Treg tiles

**Type**: short
**Topic**: Integrations — first-party tiles
**Persona**: Naive first-time founder
**Goal**: "Connect Carta so Chief can read our cap table."
**Preconditions**: None of them connected.
**Ideal path**: 2 — Equity → Carta → Sign in.
**Alternate paths**: Cap table page's own connect button (part of Cap table area); `/app/integrations?connect=carta&returnTo=/app/cap-table`.

##### Steps
1. Scrolls to "Equity". → Tile "Carta — Cap table, equity and investors" with "Connect" (`IntegrationsHome.tsx:354-362,638-672`). "Social" holds Zernio and X; "Tools" holds Treg.
2. Clicks "Connect". → Dialog "Connect Carta — Sign in with Carta in the window that opens." with a "Sign in with Carta" button (no URL box) (`CustomConnectionDialog.tsx:470-482`).
3. Signs in. → "Carta connected — The Carta agent can now read your cap table." (`CustomConnectionDialog.tsx:812-818`). No bot choice step: Carta belongs to the Carta agent only (`CustomConnectionDialog.tsx:225-228`). **Hesitation:** She had already picked "which bots can use…" for Slack and wonders why not here.
4. Back on Integrations, the Carta card shows "Open Cap table", and its page has "Allow changes in Carta" off by default; turning it on asks "Allow changes in Carta?" with "Allow changes" (`McpDetail.tsx:178-198,251-262`).

##### Variations
- X: the dialog asks for the Client ID of her own X app plus a Callback URL (`IntegrationsHome.tsx:370-380`). A founder will not have one.
- Treg: asks for an API token ("Connect Treg").

##### Edge Cases
- Already connected: tile is hidden from the sections and shows under Connected.

#### STORY-APP-179: Maya reconnects a connection whose sign-in expired

**Type**: short
**Topic**: Integrations — reconnect
**Persona**: Naive first-time founder
**Goal**: "Chief says it lost access to our docs server."
**Preconditions**: MOCK Docs MCP status "Needs reconnect".
**Ideal path**: 1 — click Reconnect on the card.
**Alternate paths**: The page's "Reconnect" button (`McpDetail.tsx:146-155`).

##### Steps
1. Integrations → card "MOCK DEMO DATA Docs MCP" with the badge "Needs reconnect" and a "Reconnect" button (`IntegrationsHome.tsx:166-175`). Clicks it. → A sign-in window opens; the badge reads "Connecting…".
2. Finishes sign-in. → Badge returns to "Connected".
3. If the server wants a client ID: the "Add a custom connection" dialog opens with Client ID fields (`useMcpReconnect`).

##### Edge Cases
- "Disconnect sign-in" on the page removes the stored sign-in but keeps the entry; status becomes "Needs reconnect".

#### STORY-APP-180: Maya cancels in the sign-in window and sees the callback page

**Type**: short
**Topic**: OAuth callbacks
**Persona**: Naive first-time founder
**Goal**: "Back out of connecting an app halfway."
**Preconditions**: A connect flow with a sign-in window (STORY-APP-018 or 176).
**Ideal path**: 1 — close the window.
**Alternate paths**: Deny on the provider's page.

##### Steps
1. In the sign-in window she clicks "Cancel" at the provider. → The window lands on Praci's callback page: "OAuth connection failed" with "OAuth authorization was cancelled." (or the provider's own error text) and "You can close this window." (`pages/McpOAuthCallback.tsx:22-72`).
2. Returns to the main window. → The dialog shows the failed state with "Try again".
3. If she opened the callback address in a normal tab rather than a popup: the same text plus a "Return to Praci" button.

##### Variations
- Success: the popup shows "Connected" and closes itself (`McpOAuthCallback.tsx:44`). Google apps use a separate page with the same texts (`pages/GoogleOAuthCallback.tsx`).
- While waiting: "Finishing MCP connection…" and "You can close this tab if it does not redirect automatically."

##### Edge Cases
- Not signed in: both callback pages redirect to `/sign-in` (`App.tsx:148-157`).

#### STORY-APP-181: Maya sees "Local command", "OpenAPI" and "GraphQL" in Advanced

**Type**: short
**Topic**: Integrations — other connection types
**Persona**: Naive first-time founder
**Goal**: "Connect our internal tool; the engineer said any of these would work."
**Preconditions**: Add a custom connection dialog open.
**Ideal path**: 3.
**Alternate paths**: Ask the engineer to do it.

##### Steps
1. Opens "Advanced". → "Transport" (Streamable HTTP, SSE), "Auth header", "Header value", "Token", and "Other connection types": buttons OpenAPI, GraphQL, Executor, "Local command", "Search directory" and, when a feed is enabled, "Search by domain" (`CustomConnectionDialog.tsx:538-640`). **Hesitation:** She cannot tell which, if any, applies; no explanation sits next to any button.
2. Clicks "Search directory", types "linear" and presses "Search". → Results with "Connect" buttons, or "No results"; some say "Manual setup required" (`CustomConnectionDialog.tsx:720-790`).
3. Clicks "Local command". → "Add a local command" with "Display name", "Command" (`/opt/mcp-server`) and "Arguments" and an "Add" button. **Hesitation:** She has no idea what command to enter; the dialog accepts anything and adds it.
4. Clicks "OpenAPI". → "Import an OpenAPI description" with "Credentials are encrypted and never sent to the model." and "Verify and add".

##### Edge Cases
- "Enter the command to run." when empty. "Could not search" on directory failure.

#### STORY-APP-182: Maya connects her bank from the Finance tile

**Type**: short
**Topic**: Integrations — Finance tiles
**Persona**: Naive first-time founder
**Goal**: "Let the Finance helper see our Mercury balance."
**Preconditions**: Mercury not connected.
**Ideal path**: 2.
**Alternate paths**: Connect from the Finance page itself (Finance area).

##### Steps
1. Integrations → section "Finance". → Tiles Mercury ("Read balances and transactions"), Brex ("Read cards, expenses and bills"), plus wallet and exchange tiles ("Wallet balances and history", "Read exchange balances") (`components/integrations/FinanceSection.tsx:369-460`).
2. Clicks "Connect" on Mercury. → A sign-in window; on success the tile moves under Connected with "Open Finance".
3. Cancels: the tile reads "Sign-in was cancelled or did not finish. Try again." with "Try again" (`FinanceSection.tsx:390`).

##### Edge Cases
- Crypto tiles ask for an API key (Blockscout "Get an API key", Alchemy "Optional faster balance reads").

#### STORY-APP-019: Maya finds "Set up app catalog" and "Server integrations" are the same page

**Type**: short
**Topic**: Integrations — server setup
**Persona**: Founder who is the deployment owner
**Goal**: "Set up Slack, Notion and GitHub for the whole company."
**Preconditions**: Maya is the deployment owner; no Composio or Pipedream account configured.
**Ideal path**: 3 — Integrations → "Set up app catalog" → Connect.
**Alternate paths**: Settings → General → "Server integrations" → "Open" (`pages/AccountSettingsOverlay.tsx:222-244`); first-run step (part A).

##### Steps
1. Integrations shows "Connect a Composio or Pipedream account to add apps like Slack, Notion and GitHub." and a button "Set up app catalog" (`components/integrations/IntegrationsHome.tsx:523-557`). **Hesitation:** She has no Composio account and does not know what it is.
2. Clicks it. → Page "Server integrations": "Choose how apps connect for everyone on this server." with five options: "Apps with their own server", "Popular apps through Composio", "Popular apps through Pipedream", "Google apps", "Your own tool server" (`components/integrations/IntegrationSetup.tsx:50-75,168-215`). Selecting Composio shows "API key" and "Get credentials" and "Connect"; Pipedream and Google show "Client ID" (and "Project ID" or "Client secret", "Redirect URI").
3. If she has several bots, a select "Bot that gets the apps you connect here" is at the bottom (`pages/IntegrationSetup.tsx:70-86`). "Back" returns to where she came from (`next` in the address).
4. Later opens Settings → General → "Server integrations — Choose how apps connect for everyone on this server. [Open]". **Hesitation:** Two names ("app catalog" and "Server integrations") for one page.

##### Variations
- Not the owner: Integrations says "App connections aren't set up on this server yet. Custom connections still work. Ask the server owner to set up the app catalog." The setup address sends her back to `/app` without a message (`pages/IntegrationSetup.tsx:30-33`).
- Signed out: `/integrations/setup` goes to `/sign-in?next=/integrations/setup` (`App.tsx:149-165`).

##### Edge Cases
- "Could not load integrations", "Could not connect", "Could not load bots. Reload to try again."

### Stories: Settings

#### STORY-APP-191: Maya opens Settings and looks for where things are

**Type**: short
**Topic**: Settings window
**Persona**: Naive first-time founder
**Goal**: "Find the setting for notifications, the model, and my password."
**Preconditions**: Maya is the deployment owner; billing enabled.
**Ideal path**: 1 — one list with plain names.
**Alternate paths**: Cmd+K "Settings" (part A); "/" then "Settings: General" (STORY-APP-153); mic button when voice is not set up (STORY-APP-152).

##### Steps
1. Clicks her name in the sidebar and chooses "Settings". → A large window titled "General" with a left list: General, Models, Memory, Voice, Usage, Billing, Updates (and "Computer" only if computers are unavailable and she is the owner) (`pages/SettingsOverlay.tsx:136-146`). **Hesitation:** "Notifications" is not in the list; it is a switch per bot (STORY-APP-016). The model is under "Models", but "which bots use it" is under each bot's Settings.
2. Clicks "Usage". → The window keeps its size; the title becomes "Usage" and focus moves into the panel (`SettingsOverlay.tsx:129-134`).
3. Presses Escape or the "x" (aria-label "Close user settings"). → Closes. While a Voice or Memory save is running, both the nav and the close button are disabled (`SettingsOverlay.tsx:97,211,233`).

##### Variations
- Phone width: the list becomes a wrapping row above the panel (`SettingsOverlay.tsx:200`).
- Non-owner: no "Computer" tab (it is for the owner only).

##### Edge Cases
- Billing tab hidden when billing is off; the selection falls back to General (`SettingsOverlay.tsx:120-122`).

#### STORY-APP-021: Maya turns on dark mode, tightens the sidebar and changes her password

**Type**: short
**Topic**: Settings — General
**Persona**: Naive first-time founder
**Goal**: "Dark mode, compact sidebar, a new password."
**Preconditions**: Signed in; password sign-in.
**Ideal path**: 3.
**Alternate paths**: Forgot password from sign-in (part A).

##### Steps
1. Settings → General. → Cards in order: "Account" (name, email, "Delete account"), "Password", "AI data sharing" (if applicable), "Appearance", "Language", "Avatars", "Server integrations" (owner only), "Advanced" (`pages/AccountSettingsOverlay.tsx:100-318`). "Messaging" appears after Password only when the server enables it (STORY-APP-190).
2. In "Appearance" clicks "Dark". → Applies at once. Under it "Sidebar density" has "Comfortable" and "Compact"; picks Compact. → The bot rows tighten.
3. In "Password" types "Current password", "New password", "Confirm password" (each at least 8 characters) and clicks "Change password". → Button reads "Changing…", then a check "Password updated" (`AccountSettingsOverlay.tsx:395-470`). Other sessions are signed out (`revokeOtherSessions: true`, `:417`). **Hesitation:** The screen does not say her other devices were signed out.
4. In "Avatars" picks "Robot" instead of "Organic". → Every bot's picture changes.

##### Edge Cases
- Mismatch: "Passwords do not match". Wrong current password: the server's message or "Could not change password". No server: "Could not reach the server".
- The Password card is missing for an account that signs in only with SSO (`AccountSettingsOverlay.tsx:121`); "Link SSO" appears under Account if SSO exists and is not linked (`components/AccountAccess.tsx:78`).
- Avatars fail: "Couldn't update avatars".

#### STORY-APP-184: Maya switches the app to Español and finds English left over

**Type**: short
**Topic**: Settings — language
**Persona**: Naive founder whose team reads Spanish
**Goal**: "Run the whole app in Spanish."
**Preconditions**: Settings → General.
**Ideal path**: 1 — pick Español.
**Alternate paths**: none found.

##### Steps
1. In "Language" opens the select. → Ten languages in their own names: English, Deutsch, 한국어, Türkçe, हिन्दी, Português (Brasil), 简体中文, Español, Русский, Français (`lib/ui-locale.ts:15-26`). Arrow keys, Home, End and Enter work (`AccountSettingsOverlay.tsx:550-690`).
2. Picks Español. → Most labels switch at once. About half of the 1,739 message ids in the Spanish catalog have no translation yet and fall back to English (counted from `locales/es/messages.po`; approximate).
3. Goes back to Chief's chat. → Table controls ("Copy rows", "Download CSV", "Sort by Amount", "1–10 of 14 rows") stay English (`packages/chat-ui/src/markdown-table.tsx:196-262`). Bot greetings and card text written by the server also stay English (`apps/api/src/onboarding.ts`).

##### Edge Cases
- Two quick picks: only the last one wins (`localeRequestRef`, `AccountSettingsOverlay.tsx:88-95`).

#### STORY-APP-185: Maya turns off AI data sharing and the bot stops with an odd message

**Type**: short
**Topic**: Settings — AI data sharing
**Persona**: Privacy-minded first-time founder
**Goal**: "Stop sending our documents to an AI service."
**Preconditions**: The deployment model provider is listed as an AI recipient, consent granted.
**Ideal path**: 2.
**Alternate paths**: Inbox consent prompt "Let Praci sort your mail" with "Allow" / "Not now" (`components/AiDataSharing.tsx:66-85`).

##### Steps
1. Settings → General → "AI data sharing". → Text: "Messages, chat history, bot instructions, memories, attachments, screenshots and connected-app content are sent to run your bots, including routines." and one switch per service named "Allow {name}" (`AiDataSharing.tsx:95-130`, `packages/contracts/src/ai-consent.ts:8-9`). If no service is listed the whole card is absent. **Hesitation:** She cannot tell what turning it off will do to Chief.
2. Turns the switch off. → The change saves at once with no confirmation.
3. Sends Chief a message. → The run is blocked. The text defined for this block is "Review AI data sharing in Account settings before continuing." (`packages/contracts/src/ai-consent.ts:40`, `packages/core/src/ai-consent.ts:65`). Where exactly it appears (composer banner or run error) was not run. **Hesitation:** There is no place called "Account settings"; the card is under Settings → General.
4. Turns it back on and resends.

##### Edge Cases
- Switch fails: the error text shows under the heading.

#### STORY-APP-186: Maya considers deleting her account

**Type**: medium
**Topic**: Settings — delete account
**Persona**: Naive first-time founder who signed up with a test email
**Goal**: "Remove the test account and its data."
**Preconditions**: Test MOCK account with a password; variant with SSO only.
**Ideal path**: 3.
**Alternate paths**: none found (no export before delete).

##### Steps
1. Settings → General → "Account". Clicks the red "Delete account" under her email. → A panel opens with "This permanently deletes your account and data." (`components/AccountAccess.tsx:84-100`). **Hesitation:** Two buttons share the label "Delete account": the first opens the panel, the second does the deletion.
2. Password account: types "Current password". The second "Delete account" button enables only with a password (`AccountAccess.tsx:183-189`). Clicks it. → She is sent to `/sign-in` with no extra confirmation (`AccountAccess.tsx:202`).
3. SSO-only account: sees "Sign in again" first and, if email deletion is on, "Send deletion code" and then a "Deletion code" field (`AccountAccess.tsx:128-176`).

##### Variations
- Wrong password: the server's message or "Could not continue".

##### Edge Cases
- Sign-in options fail to load: "Could not load sign-in options." with "Retry" (`AccountAccess.tsx:96-110`).
- The page does not say what happens to the Northwind data if she is the only owner.

#### STORY-APP-020: Maya switches to a stronger model with her own API key

**Type**: medium
**Topic**: Settings — Models
**Persona**: Founder told by a friend "use your own Anthropic key"
**Goal**: "Make the answers better; use my company's key."
**Preconditions**: A deployment model is active; MOCK key `sk-MOCK-DEMO-DATA-0001` accepted by a stub provider.
**Ideal path**: 4 — Models → provider → key → Use this model.
**Alternate paths**: Per-bot model in bot Settings → Advanced (STORY-APP-161); the first-run "Connect a model" (part A).

##### Steps
1. Settings → Models. → A line "Choose which connected model Praci uses." Then "Active model {name} {provider}" and, when set, "Thinking: …"; "Configured by deployment" when the model comes from the server. Below, a collapsed "Data room search model". Left list "Providers" with "Search providers", groups "Connected" and "All providers" (`pages/ModelSettingsOverlay.tsx:1135-1225`). **Hesitation:** "Thinking", "Providers" and "Data room search model" mean nothing to her.
2. Types "anthropic" in "Search providers" and clicks the provider. → Right pane: "Connect this provider to use it as your personal model." then an "API key" field (placeholder `sk-…`) and, for providers that can be checked, a "Test API key" button (`ModelSettingsOverlay.tsx:1020-1075`, `components/ModelConnectionPreflightNotice.tsx:34`).
3. Pastes the key and clicks "Test API key". → "Testing…", then a success or failure line. Clicks "Connect API key". → "Connected and using {model}." in green (`ModelSettingsOverlay.tsx:1204-1215`, notice at `:139`). Below: "Connected · {label}" and "Stored securely. Never shown here.", plus model and thinking pickers.
4. Picks a model and clicks "Use this model" (`ModelSettingsOverlay.tsx:1103-1130`). → "Now using {model}." and "Active model" updates.
5. Opens a bot's Settings → Advanced → Model. **Hesitation:** Settings → Models changes the default; each bot may still override it ("Space default ({model})").
6. Back to Models → provider → "Disconnect". → Dialog "Disconnect {name}?" "This removes the connection from every space." (`ModelSettingsOverlay.tsx:1485-1512`).

##### Variations
- The provider the server already uses: "This space already uses {name}." with a "Use your own key" disclosure (`ModelSettingsOverlay.tsx:1436-1456`).
- An OpenAI-compatible server: "Server URL", "Find models", "Models from server", "Other model…", "Model id" (`ModelSettingsOverlay.tsx:1240-1335`).
- A subscription provider shows a sign-in button and a code box "Authorization code or callback URL" with "Submit".
- "Data room search model": an "Embedding model" box that saves when she leaves it (`ModelSettingsOverlay.tsx:1543-1600`).

##### Edge Cases
- Short key (under 8 characters): "Connect API key" stays disabled with no message.
- Catalog empty: "No model catalog is available." Save fails: "Could not connect this provider".

#### STORY-APP-183: Maya adds a backup model in case the first one fails

**Type**: short
**Topic**: Settings — backup models
**Persona**: Naive first-time founder
**Goal**: "If the main model is down, still get an answer."
**Preconditions**: Two models connected (APP-020).
**Ideal path**: 3 — pick, Add, Save backups.
**Alternate paths**: none found.

##### Steps
1. Scrolls to the bottom of Models → "Backup models" (`pages/ModelBackupsSettings.tsx:249`). → "Add connected models to use them as backups." (or "Connect a provider to add backups." if none).
2. Opens "Add connected model" (a select with "Select a connected model"), picks one, clicks "Add". → A row with up and down buttons (aria-labels "Move {model} up/down") and "Remove" (`ModelBackupsSettings.tsx:267-330`).
3. Clicks "Save backups". → "Backup models saved." **Hesitation:** Nothing says in what order or after what kind of failure a backup is used.

##### Edge Cases
- Maximum is 10: "Maximum of 10 backup models." A model whose provider was disconnected shows "Not connected".
- Failures: "Could not load backup models", "Could not save backup models" with "Retry"; changing space while open: "Space changed. Reopen Models to save its backup list."

#### STORY-APP-188: Maya opens Memory settings and sees provider jargon

**Type**: medium
**Topic**: Settings — Memory
**Persona**: Naive first-time founder
**Goal**: "See what Praci remembers and make sure it forgets one thing."
**Preconditions**: No memory provider connected. Chief and Finance helper each have memory documents.
**Ideal path**: 2 — scroll to the document list, open one.
**Alternate paths**: Per-bot Memory tab (STORY-APP-162).

##### Steps
1. Settings → Memory. → Text "Manage the Space semantic memory provider." and a form: "Provider" (only when more than one), "Default scope" with "Isolated" / "Shared", and the provider's fields (Supermemory: "Cloud" / "Local", "Base URL", "Organization API key"; Serenity: "MCP endpoint", "Bearer token", "Brain label", "Allow writing") and "Connect" (`pages/MemorySettingsOverlay.tsx:155-246`, `pages/memory-providers/*Form.tsx`). **Hesitation:** She wants to see memories, not set up a service. The words "semantic", "Space", "scope" and "Supermemory" are all new.
2. Scrolls past the form. → The list of documents grouped under "Shared documents" and each bot's name, with a "Filter memory" box (shown once any document exists) and "Download as markdown" (`pages/KnowledgeSection.tsx:63-120`).
3. Types "investor" in "Filter memory". → Matching documents; "No matches" otherwise.
4. Opens a document and edits (same rules as STORY-APP-162).

##### Variations
- A provider is connected: the card reads "Connected", the provider label, "Default scope" and "Disconnect".
- "The selected memory provider is not available in this build."

##### Edge Cases
- Failures: "Could not connect {name}", "Could not disconnect memory provider", "Could not update the default memory scope".

#### STORY-APP-189: Maya connects a voice provider and hears a sample

**Type**: medium
**Topic**: Settings — Voice
**Persona**: Naive first-time founder who arrived from the mic button
**Goal**: "Make the mic work and hear replies read aloud."
**Preconditions**: A MOCK voice API key accepted by a stub.
**Ideal path**: 4.
**Alternate paths**: Per-bot "Read replies aloud" and "Voice" (STORY-APP-161).

##### Steps
1. Settings → Voice (or arrives from the mic). → Left list "Providers", each tagged "Speak + transcribe" or "Speak only"; a "Connected" tag for linked ones (`pages/VoiceSettingsOverlay.tsx:205-255`). Right pane "Loading voice providers…".
2. Clicks a "Speak + transcribe" provider. → "API key" field (placeholder "Paste your API key") and a "Connect" button.
3. Pastes the key and clicks "Connect". → "Connecting…", then "Connected {name}." and the pane gains a "Voice" select, an optional "Speech model" (one provider only), and "Hear a sample".
4. Clicks "Hear a sample". → "Playing…", it speaks "Hi, this is how I'll sound when I read replies out loud.", then "If you heard that, voice is ready." (`VoiceSettingsOverlay.tsx:170-182`).
5. Closes Settings. Clicks the mic in Chief's chat. → The call card appears (STORY-APP-152). Reply bubbles now show a "Speak" link (`pages/Shell.tsx:7603-7612`).

##### Edge Cases
- "Replace key" and "Disconnect" for a linked provider. Failures: "Could not connect this voice provider", "Could not save that voice", "Could not play a test clip".
- While a save is running the Settings nav is locked (STORY-APP-191).

#### STORY-APP-187: Maya opens "Updates" and finds nothing

**Type**: short
**Topic**: Settings — Updates
**Persona**: Naive first-time founder using the web app
**Goal**: "Check that I have the latest version."
**Preconditions**: Web (not the desktop app); hosted server (not a sidecar install).
**Ideal path**: 1.
**Alternate paths**: Desktop app shows "Desktop app" with the version and "Check for updates" (`components/DesktopUpdates.tsx:138-170`).

##### Steps
1. Settings → Updates. → The panel is empty: neither section renders (`pages/AccountSettingsOverlay.tsx:382-392`, `components/DesktopUpdates.tsx:130`, `components/SoftwareUpdateSection.tsx:132-160`). The tab itself is always listed. **Hesitation:** She thinks it is broken.
2. On the desktop app she sees "Desktop app", the version, "Check for updates", then "Up to date" or "Restart to update" (`DesktopUpdates.tsx:138-170`). The owner of a self-hosted install also sees "Software update" with "Check for updates" and "Update" and the messages "Up to date" / "Update available".

##### Edge Cases
- "Checkout has local changes. Clean it before updating." and "The API did not come back. Refresh this page." for the software update.

#### STORY-APP-190: Maya links a chat app (feature flag on)

**Type**: short
**Topic**: Settings — Messaging
**Persona**: Naive first-time founder
**Goal**: "Text Chief from WhatsApp."
**Preconditions**: Server messaging enabled; otherwise the section is absent.
**Ideal path**: 3.
**Alternate paths**: none found.

##### Steps
1. Settings → General → "Messaging" → "Manage messaging settings". → An overlay "Messaging" with "Chat apps", "Channels", "Agent connections", "Team conversations" (`pages/MessagingSettingsOverlay.tsx:98-340`).
2. Under "Chat apps" picks "Choose a bot…" → Chief, clicks "Link a chat app". → "Send 7K4Q to the line from your chat app within 10 minutes. You'll get a confirmation reply once linked." (code is MOCK.) **Hesitation:** "The line" is not defined; the only hint is the list of provider names printed above the buttons.
3. Later a group invite appears under "Channels" with "Approve" and "Decline"; after approval a "Leave" button.

##### Edge Cases
- "No chat apps linked yet.", "No group chats yet.", "No agent connections yet.", "No team conversations yet." "Couldn't load messaging settings".
- Team conversation "Settings" opens per-room options: "Listening" (default, Listen, Mentions only), "Room guidance", "Automated senders" with handling "Ignore / Group updates / Always act / Treat like a person" (`pages/ExternalConversationSettings.tsx:55-235`).

#### STORY-APP-022: Maya checks what she pays and how much she used

**Type**: short
**Topic**: Settings — billing and usage
**Persona**: Founder watching burn
**Goal**: "When does my trial end, and how much did we use?"
**Preconditions**: Billing enabled, Trial with 5 days left; usage of 41 runs and 120k tokens (MOCK).
**Ideal path**: 2.
**Alternate paths**: User menu "Usage" opens Settings at Usage; the slash entry "Settings: Usage" (STORY-APP-153).

##### Steps
1. Settings → Billing. → A card with the heading "Trial", a price line (for example "$20 / month · 2 seats" when there is more than one seat), "Trial ends Oct 22", and a "Manage" button (shown only for an owner of the billing account with a customer record) (`pages/BillingSettingsPanel.tsx:76-120`). Clicks "Manage". → Browser goes to the payment provider's portal; on the desktop app it opens in the system browser and the button re-enables.
2. Settings → Usage. → "41 runs · 120,000 tokens" and the line "Model spend uses your provider keys." (`AccountSettingsOverlay.tsx:336-351`). **Hesitation:** She never added a key; the line suggests she pays a provider herself.

##### Variations
- State words: Trial, Active, Past due, Canceled, Inactive; dates "Ends {date}" or "Renews {date}" (`BillingSettingsPanel.tsx:48-62,74-87`).
- Member who cannot manage billing: no "Manage" button and no explanation.

##### Edge Cases
- "Could not load billing" (the Skeleton disappears), "Could not open billing".
- Usage not loaded: only the key line shows. Tokens unknown: "— tokens".

#### STORY-APP-023: Maya tries to invite her cofounder

**Type**: short
**Topic**: Members and invites
**Persona**: Naive first-time founder
**Goal**: "Add Sam (cofounder) so we share Chief and the data room."
**Preconditions**: Shared seed; second MOCK person "Sam Patel, sam@northwind.example" with no account yet; billing shows 2 seats.
**Ideal path**: 3 — Settings → Members → invite email. This does not exist.
**Alternate paths**: none found. No invite or member screen exists in `apps/web/src`; the only "invited" in the web app is a messaging channel status (`pages/MessagingSettingsOverlay.tsx:210`).

##### Steps
1. Looks in Settings (General, Models, Memory, Voice, Usage, Billing, Updates). → No Members tab.
2. Opens Billing and sees "2 seats" next to the price. **Hesitation:** She assumes seats are people and looks for how to fill them. There is no control (`BillingSettingsPanel.tsx:78-90`).
3. Tries "+" → "New space" hoping it is shareable. → "Private workspace with its own bots and groups." No invite.
4. Sees "Computer: Team / Private" under bot Advanced. **Hesitation:** She reads "Team" as sharing with her team (STORY-APP-161).
5. Result to record: she cannot finish the goal. Sam would have to sign up separately and would see none of her bots.

##### Edge Cases
- Sam signing up with the same email shows the normal sign-up errors (part A).

### Stories: End-to-end

#### STORY-APP-025: Maya produces and sends a monthly investor update

**Type**: long
**Topic**: Chat, tables, quotes, approvals, notifications
**Persona**: Naive first-time founder before a deadline
**Goal**: "Get a draft investor update with a burn table, check it, and email it to investors."
**Preconditions**: Full seed; Gmail connected; Chief can send mail with approval; "Ask before sending external email" set (STORY-APP-158); MOCK investor list `investors@mock-northwind.example`; browser notifications allowed.
**Ideal path**: 6 — ask → review → refine → approve email → confirm sent.
**Alternate paths**: Compose in Inbox ("New message") and paste; ask the Leadership group (STORY-APP-015); copy with "Copy rows" (STORY-APP-014).

##### Steps
1. In Chief: "Draft our September investor update with a burn table from the finance data." → Streams a reply with a table and possibly a file card. Status line says "Thinking", then "Writing".
2. Sorts the table by Amount; "Copy rows" and pastes into a sheet (STORY-APP-014).
3. Selects the sentence "runway is 14 months" and clicks "Quote": "Use the real runway number from Finance." (STORY-APP-151). → Revised version.
4. Reacts 👍 on the final version (STORY-APP-013).
5. "Email this to investors@mock-northwind.example." → An approval card for mail appears (To, Cc, Bcc, Subject, Message with "Edit", "Send", "Discard"; prior STORY-031..033). Edits the subject and clicks "Send". → "Sending…" then "Sent by you" (`components/MailApprovalCard.tsx:190-225`).
6. Switches to Finance while it sends. A browser notification appears when Chief finishes (STORY-APP-016).
7. Opens Inbox → Sent to confirm.
8. Opens Artifacts from the sidebar to find the saved draft for next month.
9. Opens Chief → Bot computer → creates a monthly routine "MOCK Monthly investor update" (STORY-APP-172).

##### Variations
- Mail fails: "Not sent" with "Not confirmed as sent. Check Sent in your mail before trying again." and "Open in composer" (`MailApprovalCard.tsx:460-475`).
- Turn off sending: the "More" menu has "Disable sending for Chief"; a note says "Sending is off for Chief. Turn it back on in its tools." (`MailApprovalCard.tsx:448-492`).

##### Edge Cases
- Approval card answered on another device (prior STORY-044).
- "Copy" in "More" gives no feedback (STORY-APP-013), so she may paste stale text.
- She leaves the chat before sending: her typed follow-up is lost (STORY-APP-012).

### Redundancy Candidates (this area)

- **"Server integrations" vs "Set up app catalog"** are one page reached from three places (Settings card, Integrations banner, sign-in redirect) with two names (STORY-APP-019).
- **Two "Delete account" buttons** in one card (STORY-APP-186).
- **Settings → Voice vs bot "Read replies aloud" / "Voice"** vs the mic call button: three voice entry points with different meanings (STORY-APP-152, 161, 189).
- **Model choice in four places:** Models settings, bot Advanced, routine "Advanced" popover, first-run model step (STORY-APP-020, 161, 173).
- **Memory in two places:** bot Advanced "Memory" tab and Settings → Memory both list and edit documents (STORY-APP-162, 188).
- **"Reply" appears as both a hover icon and a "More" menu entry** (STORY-APP-013).
- **Two ways to open bot Settings:** clicking the chat title and "Edit profile" in the row menu.
- **Chat Settings, Settings: General, Settings: Usage** appear in the slash list while the same screens are in the user menu (STORY-APP-153).
- **Eight sections on Integrations home** where only "Connected", "Find an app" and "Anything else" differ in function; Finance, Social, Equity and Tools are first-party groups (STORY-APP-176, 178, 182).
- **Three save styles in one bot Settings panel:** blur autosave for text fields, an explicit Save for model and voice, immediate save for tools (STORY-APP-161).

### Suspected problems (this area)

Each was read in code; none was run in a browser unless the story says so.

1. **Group copy is wrong.** The "Groups" info says "They all reply in the same thread" (`pages/shell/dialogs.tsx:204`), but with no mention only the first member answers (`packages/core/src/group-mentions.ts:52-54`). (STORY-APP-011, 168)
2. **Reactions cannot be undone and are not buttons.** Every click adds a message; a repeat click raises the count (`packages/core/src/message-reactions.ts:20-38`, `apps/api/src/thread-target.ts:1020-1064`, `pages/Shell.tsx:6037-6056`). (STORY-APP-013)
3. **"Up" recall likely includes reactions.** The history uses every user message, and a reaction is a user message with the emoji as text (`pages/Shell.tsx:1989-1999`, `apps/api/src/thread-target.ts:1046`). (STORY-APP-154)
4. **Typed draft is lost when you switch chats.** The composer is keyed by chat and holds the draft in local state (`pages/Shell.tsx:3206,6236`). (STORY-APP-012)
5. **Unsupported attachments are skipped with no reason.** The notice lists the name only (`pages/Shell.tsx:2305-2312`). Accepted types exclude Word, Excel and PowerPoint (`packages/contracts/src/attachments.ts:14-23`). (STORY-APP-155)
6. **Two drop targets look alike.** The composer accepts files as attachments; anywhere else in the window the file goes to the Data room (`components/data-room/DropZone.tsx:55-60`). (STORY-APP-155)
7. **Slash list has no keyboard handling.** Enter sends "/usage" as a message (`pages/Shell.tsx:6905-7060`). (STORY-APP-153)
8. **Bot Settings mixes autosave and manual save.** Name, Title, Description, Notifications and tools save on their own; Model, Thinking, Computer, Read replies aloud, Voice and Memory scope need "Save", and leaving loses them with no warning (`pages/shell/bot-panel.tsx:392,628-642`). (STORY-APP-161)
9. **Advanced hides credentials and the main model switch.** Credentials, model and tools live under "Advanced" (`bot-panel.tsx:443-621`). (STORY-APP-159, 161)
10. **Routines are only reachable through the "Bot computer" icon,** under a screen preview (`pages/Shell.tsx:4299,4577-4620`). Blank name and instruction save as "Routine" and "Check in." (`Shell.tsx:4760-4761`), and Save gives no confirmation. (STORY-APP-172)
11. **Disabled "Slack message" trigger gives no way to fix it.** Tooltip "Slack not enabled" only (`RoutineEditor.tsx:567-580`). (STORY-APP-173)
12. **"Updates" tab is empty for most users.** It is always listed, but both sections return nothing unless desktop or owner on a sidecar install (`pages/SettingsOverlay.tsx:139`, `components/DesktopUpdates.tsx:130`). (STORY-APP-187)
13. **Consent error names a screen that does not exist.** "Review AI data sharing in Account settings" (`packages/contracts/src/ai-consent.ts:40`); the card is in Settings → General. (STORY-APP-185)
14. **Connect dialog numbering stops at step 2.** "Step 1 of 3", "Step 2 of 3", then an unnumbered done screen; Carta says "of 2" (`components/integrations/SignInStep.tsx:14`, `AgentStep.tsx:26`). All bots start checked in step 2, so the quick path gives every bot the app. (STORY-APP-176)
15. **Two accounts, one bot list.** Access is set per app, not per account (`AppDetail.tsx:183`). (STORY-APP-177)
16. **Remove vs Disconnect wording is easy to confuse** when one account is left (`AppDetail.tsx:386-397`). (STORY-APP-017)
17. **Language switch leaves English** in chat tables and server-written text; about half of the Spanish catalog is untranslated (`locales/es/messages.po`). (STORY-APP-184)
18. **Tool activity is hidden by default and stored only in the browser** (`lib/tool-activity-preference.ts:35-37`), so a long run looks idle on a second device. (STORY-APP-156)
19. **Approval rule buttons look like actions, not toggles,** and a second click is silent (`components/ApprovalRulesSettings.tsx:46-58,117-130`). (STORY-APP-158)
20. **Billing prints a seat count with no way to add a person** (`pages/BillingSettingsPanel.tsx:78-90`). (STORY-APP-023)
21. **Copy gives no feedback.** The message "Copy" and the Export download show nothing (`pages/Shell.tsx:7258-7262`, `bot-panel.tsx:645`). (STORY-APP-013, 166)
22. **Mic button starts a call, not dictation** (`pages/Shell.tsx:3224-3238`); without a voice provider it jumps to Settings. (STORY-APP-152)

## Area: Cross-feature journeys (STORY-APP-nnn)

**Generated**: 2026-10-17. **Code read at**: `559a76ad` (branch docs/ux-pass).
**Total stories**: 16 (short 4, medium 5, long 7). Ids STORY-APP-200 to 214, plus the rewritten STORY-APP-024.
**Source of truth**: the area catalogs written on 2026-10-17: `inbox/catalog.md` (STORY-INB), `finance/catalog.md` (STORY-FIN), `legal/catalog.md` (STORY-LEG), `captable/catalog.md` (STORY-CAP), `dataroom/catalog.md` (STORY-DRM), `app/catalog-a.md` and `app/catalog-b.md` (STORY-APP). Labels and routes are taken from those files and spot-checked against the code (`HideAmountsToggle.tsx:12,58` "Hide amounts"/"Show amounts"; account menu at the bottom of the sidebar; Legal tabs Contracts, Deadlines, Graph).

### Changes since the 2026-10-16 catalog

- **Changed**: STORY-APP-024 "Maya's Monday morning across the whole app" is rewritten. The old version assumed "Import from email" exists on `main`, and it did not name the real card labels. It now follows the area catalogs (Inbox agent panel, Finance Ask panel, Cap table, Data room, Chief) and marks the PR #109 steps.
- **Moved to the area catalog**: STORY-APP-025 (monthly investor update by Chief) stays in `catalog-b.md`. The new STORY-APP-210 is the longer version that starts from the Finance and Cap table pages and ends in an approval-gated Inbox send.
- **Added**: STORY-APP-200 to 214 (all new cross-feature journeys).
- **Dropped**: none.

### Preconditions used by these journeys

- Persona: Maya Chen, "Northwind Robotics", a first-time founder. Mock people: Luis Park at Acme Logistics (`luis@acme-logistics.example`), Priya Shah (investor, Harbor Ventures), counsel Ellis Law (`counsel@ellis-law.example`), cofounder Sam Lee.
- **PR #109 (`origin/feat/legal`)** adds the Data room buttons "Import from email" and "Import from Google Drive" (icon-only on the Data room header), the agent tool `add_to_data_room`, and the Legal page. Every step that uses them is tagged **[needs PR #109]**. On `main` today there is no Legal tab and no import control (STORY-INB-016, STORY-LEG-020, STORY-DRM-041).
- Hide amounts is one browser-side switch (account menu row, the eye on Finance and Cap table). It does not hide everything (see Suspected problems).
- Seeds named as in the area catalogs: A1 Inbox account, M-numbers for mail (M3 Luis demo mail, M6 signed MSA, M9 board prep, M2 Invoice #4471), D2 Legal deadlines, NW-BASE Finance, `carta-connected` Cap table.

### Summary

Fifteen new journeys plus the rewritten Monday morning. Short ones (200, 201, 203, 204) test one seam between two areas. Medium ones (202, 205 to 208) test a repeated assumption: that a thing done in one place shows up in another. Long ones (209 to 214, 024) are whole days a founder would have: first day, investor update, board prep, contract renewal, phone-only day, diligence packet, Monday.

### Coverage Matrix

| Seam | Stories | Linked area stories | Gaps |
| --- | --- | --- | --- |
| Email attachment to Data room to Legal | 200, 205, 212, 214, 024 | INB-016, DRM-020, DRM-043, LEG-018 | Legal does not read mail on its own (S-LEG-04) |
| Hide amounts across areas | 201, 202, 211 | FIN-024..031, INB-034, CAP-021, CAP-033, DRM-034, LEG-026 | no Hide amounts control on Inbox or Legal pages |
| Ask the page agent vs Chief | 203, 209, 213 | FIN-006, APP-157, APP-124 | two assistants with different tools |
| Approval-gated send | 204, 210, 212 | INB-020, INB-028, APP-158 | Inbox agent cannot skip the card; Chief can be set to ask |
| Delete in one area, effect in another | 206 | LEG-028, DRM-017 | no warning on delete |
| Connect once, use everywhere | 207, 209 | INB-001, DRM-041, FIN-001, CAP-003, APP-182 | five doorways, five wordings |
| Consent / AI data sharing | 208 | INB-002, DRM-009, LEG-004 | no single place to see all consents |
| Whole-day journeys | 024, 209..214 | most | none found |

### Story Dependency Graph

200 -> 205 -> 212. 207 -> 209. 201 -> 202 -> 211. 203 -> 210 -> 214. 204 -> 212. 208 -> 206. 024 and 213 stand alone.

---

### Stories: Short seams between two or three features

#### STORY-APP-200: Maya moves a signed contract from an email into Legal

**Type**: short
**Topic**: Inbox to Data room to Legal
**Persona**: Maya, who has a signed MSA in Luis's email and has heard that Praci "knows about contracts"
**Goal**: "Make my signed MSA show up in the contracts list with its dates."
**Preconditions**: **Requires PR #109 (origin/feat/legal).** A1; M6 "Acme_Northwind_MSA_signed.pdf"; Gmail connected; Data room consent given (STORY-DRM-009); Legal consent given.
**Ideal path**: 5 — open mail, Data room, import, Legal, Scan now.
**Alternate paths**: drag the downloaded PDF onto any page (STORY-INB-016); let the Inbox agent do it (STORY-DRM-044); ask the Legal agent (it lists the email but cannot add it, STORY-LEG-018).

##### Steps
1. Opens M6 in the Inbox, sees the chip "Acme_Northwind_MSA_signed.pdf 3.4 MB". She expects a "Save to Data room" action; the chip only downloads (STORY-INB-016). **Hesitation:** she does not know the Data room is where Legal looks.
2. Opens **Data room**, clicks the envelope icon (aria label "Import from email"), searches "Acme", ticks the PDF, clicks **Import** (STORY-DRM-020). A notice reads "Imported 1 file".
3. Opens **Legal** (`/app/legal`). The tile "Unreviewed documents" shows 1. She expects the contract to appear at once. It does not until **Scan now** is clicked (STORY-LEG-005, S-LEG-01).
4. Clicks **Scan now**. The page polls; the row "Master Services Agreement" appears under Contracts with parties and a next deadline.

##### Variations
- Consent not given on Legal: the card "Let the Legal agent read your documents" blocks Scan now until **Allow** (STORY-LEG-004).
- No Gmail connection: the Data room button reads "Connect Gmail" (STORY-DRM-041).

##### Edge Cases
- On `main` (no PR #109) step 2 does not exist; the path is download, drag, upload, and there is no Legal page (STORY-LEG-020).

#### STORY-APP-201: Maya hides amounts, then screenshots Finance and Cap table

**Type**: short
**Topic**: Hide amounts across Finance and Cap table
**Persona**: Maya, about to send a screenshot to an advisor
**Goal**: "Take two screenshots with no dollar figures in them."
**Preconditions**: NW-BASE Finance connected; `carta-connected` with a saved snapshot.
**Ideal path**: 4 — account menu, Hide amounts, Finance screenshot, Cap table screenshot.
**Alternate paths**: eye icon on Finance or Cap table (same switch, STORY-FIN-024, CAP-021).

##### Steps
1. Clicks her name at the bottom of the sidebar, then **Hide amounts** (STORY-FIN-025). The row now reads "Show amounts".
2. Opens Finance: Cash, Burn, Runway show "$•••"; the eye icon is crossed out. Takes screenshot one.
3. Opens Cap table: money cards are masked, the ownership bar still shows Maya 62.0 percent and the others as proportions (STORY-CAP-021, Suspected problems in that catalog). **Hesitation:** she wanted "no figures" and the percentages are figures.
4. Takes screenshot two. Opens the account menu and clicks **Show amounts** when done; both pages unmask without reload.

##### Variations
- Runway "7.9 mo" and "Until May 2027" are not currency, so they show (STORY-FIN-027).

##### Edge Cases
- A different browser profile starts with amounts shown (STORY-CAP-033).

#### STORY-APP-203: Maya asks Chief about runway, then checks it on Finance

**Type**: short
**Topic**: Chief vs Finance page
**Persona**: Maya who does not know there is more than one assistant
**Goal**: "Tell me how long our money lasts, and let me see where that number comes from."
**Preconditions**: Mercury connected (STORY-FIN-001), NW-BASE; Chief has Finance tools.
**Ideal path**: 3 — ask Chief, read answer, open Finance runway.
**Alternate paths**: **Ask** button on Finance (the Finance agent panel).

##### Steps
1. In Chief's chat types "When do we run out of money?" The reply gives a runway and a month.
2. Opens **Finance**, clicks **Runway** (`/app/finance/runway`). Sees Cash, Monthly burn, Runway, Run-out, the dashed projection and the list "Financing — Excluded" (STORY-FIN-006).
3. Compares: Chief said "about 8 months" and the page says "7.9 mo, Until May 2027". She wonders if they are the same number. **Hesitation:** one is Chief's rounding, the other the page's calculation; nothing says so.

##### Variations
- She clicks **Ask** on the runway page instead: the Finance agent panel opens with its own thread, so the earlier answer is not there (STORY-APP-167).

##### Edge Cases
- Mercury token expired: the page shows a yellow dot on the chip and Chief says it cannot read balances (STORY-FIN-022).

#### STORY-APP-204: Maya approves an email, then checks that it left

**Type**: short
**Topic**: Approval card, Activity, Inbox
**Persona**: Maya
**Goal**: "Send Luis 'Friday works' and be sure it went."
**Preconditions**: A1; AGENT-READY; pending card CARD-PENDING (STORY-INB-020).
**Ideal path**: 3 — Send on the card, bell, Inbox Sent.
**Alternate paths**: write it herself (STORY-INB-009).

##### Steps
1. In the Inbox agent panel reads the card "Mail Needs approval · luis@acme-logistics.example" and clicks **Send**. The header folds to "Approved to send" (STORY-INB-020).
2. Switches to Finance. When the run ends, the bell shows the run under "Finished" (STORY-APP-124). **Hesitation:** nothing says the email left; the card still says "Approved to send".
3. Returns to Inbox and opens M3: "Later in this conversation" shows her reply (STORY-INB-027). Now she believes it.

##### Variations
- Tab hidden when the run ends: browser notification "finished" (STORY-APP-126).

##### Edge Cases
- Gmail rate limit: "Gmail is limiting requests right now" (STORY-INB-018); the card stays "Approved to send" while mail waits.

---

### Stories: Medium seams

#### STORY-APP-202: Maya hides amounts and checks every page for leaks

**Type**: medium
**Topic**: Hide amounts sweep
**Persona**: Maya, careful before an investor Zoom
**Goal**: "Make sure no dollar amount shows anywhere on my screen."
**Preconditions**: A1 with M2 "Invoice #4471" ($4,820.00 due Nov 10); NW-BASE; `carta-connected`; DR-SEEDED with "Invoice NW-1042 Acme Servo Supply.pdf"; **Legal part requires PR #109**, D2.
**Ideal path**: 2 per page in the best case; the real path is a sweep of 8 pages because no page says what is covered.
**Alternate paths**: none found.

##### Steps
1. Account menu, **Hide amounts**. Helper text: "Hides amounts on finance screens and masks currency amounts in chat text. Plain numbers in agent replies may still show."
2. Finance dashboard and a month page: masked (STORY-FIN-027).
3. Crypto and accounts: masked (STORY-FIN-028).
4. Cap table: money masked, proportions visible (STORY-CAP-021).
5. Inbox list: M2 still reads "$4,820.00 due Nov 10" in the preview; opening M2 shows "$•••" (STORY-INB-034). **Hesitation:** the helper names "finance screens", not email.
6. Data room: opens the invoice; Amount reads "$•••"; a scanned image reads "Image hidden while amounts are hidden" (STORY-DRM-034).
7. **[needs PR #109]** Legal Deadlines: a row such as "Early termination fee $12,000" is shown unmasked and there is no eye icon on the page (S-LEG-12).
8. Chief's chat: asks "what did we spend on hosting?" The currency amount is masked, a plain "4,820" may not be (STORY-FIN-029).
9. Turns it off in the account menu; everything returns.

##### Variations
- On a phone, the toggle is in the same account menu inside the drawer (STORY-FIN-030).

##### Edge Cases
- Subjects and list previews in Inbox, and the email cards in the Inbox agent panel, are never masked.

#### STORY-APP-205: A Legal deadline sends Maya back to the email

**Type**: medium
**Topic**: Legal to Inbox
**Persona**: Maya
**Goal**: "Legal says a trademark response is due Nov 14. Show me the email that says so and answer it."
**Preconditions**: **Requires PR #109.** D2 with "Trademark office action response" 2026-11-14 (due in 29 days, today 2026-10-16); Gmail connected; the notice email exists only in the Inbox.
**Ideal path**: 4 — Legal, Deadlines, find email in Inbox, forward to counsel.
**Alternate paths**: ask the Inbox agent "find the trademark email" (STORY-INB-019).

##### Steps
1. Opens **Legal**, clicks **Deadlines**. Sees "Trademark office action response · Due in 29 days" with a grey line naming the contract and a quote (STORY-LEG-007).
2. Looks for a link to the email. Only "Open document" appears for Data room files; the notice was found in mail and is only in the Agent's chat reply (S-LEG-04, STORY-LEG-018). **Hesitation:** she assumes the page is built from her mail.
3. Goes to **Inbox**, types "trademark" in the search box, finds the email, opens it (STORY-INB-033).
4. Clicks **Forward**, types `counsel@ellis-law.example`, adds "Please respond by Nov 14", clicks **Send** (STORY-INB-011).
5. Back on Legal, the deadline still shows open. She clicks **Done**: "Marked Trademark office action response done." with **Undo** (STORY-LEG-012). **Hesitation:** she is marking it done because she forwarded it, not because the filing happened.

##### Variations
- She clicks **Dismiss** by mistake and uses **Undo** within 8 seconds.

##### Edge Cases
- Done/Dismiss cannot be reopened after the Undo disappears (S-LEG-06).

#### STORY-APP-206: Maya deletes a Data room file and her Legal dates disappear

**Type**: medium
**Topic**: Data room delete and Legal cascade
**Persona**: Maya tidying folders
**Goal**: "Remove the duplicate lease PDF."
**Preconditions**: **Requires PR #109.** D2; Data room has two copies of "Office lease 2024.pdf" (one scanned in Legal); STORY-DRM-017 setup.
**Ideal path**: 2.
**Alternate paths**: ask the Legal agent to dismiss the date instead (STORY-LEG-029).

##### Steps
1. Opens Data room, searches "lease", sees two rows with identical names. Deletes the one with the older date (STORY-DRM-017).
2. Opens Legal. The lease contract, its "Renews" and "Renewal notice deadline" rows and its graph box are gone (STORY-LEG-028). **Hesitation:** "Did the app lose my renewal date?"
3. She goes back to the Data room; the other copy is present but unscanned; **Unreviewed documents** is now 1.
4. Clicks **Scan now**; the lease and dates return.

##### Variations
- She deleted the scanned copy. Manual deadlines linked to that contract are deleted too (S-LEG-12).

##### Edge Cases
- Two tabs: a folder deleted in another tab makes her next upload fail with "Upload failed" and no reason (STORY-DRM-028).

#### STORY-APP-207: Maya connects Gmail once and expects it everywhere

**Type**: medium
**Topic**: Connection doorways
**Persona**: Maya
**Goal**: "I connected my email. Why does every page still ask?"
**Preconditions**: Fresh account; no connections. **Data room steps need PR #109.**
**Ideal path**: 3 for the first doorway; real path is 5.
**Alternate paths**: connect from Chief's "Authorize" card (STORY-APP-001).

##### Steps
1. Opens **Inbox**: "No mail connected"; clicks **Connect mail** (`/app/integrations?q=gmail`, STORY-INB-001). Connects Gmail.
2. Opens **Data room**: buttons "Choose files", "Connect Gmail", "Connect Google Drive". The Gmail button still says "Connect Gmail" until the page is reloaded; the list of connections is read once (STORY-DRM-041).
3. Opens **Legal**: an agent scan can see mail only for the owner's own run (STORY-LEG-018).
4. Opens **Finance**: "No accounts yet" with **Add account**. Gmail is not a bank, and she cannot tell that Mercury needs a different sign-in (STORY-APP-182).
5. Opens **Cap table**: "Connect Carta" (STORY-CAP-003).
6. Opens Integrations: three separate Connect flows for her three apps; each reads "Connect" and none says it only enables one page.

##### Variations
- Gmail limited to the Finance helper (STORY-APP-177): Chief and the Inbox agent lose mail; Inbox shows the list but the agent says it cannot read it.

##### Edge Cases
- She disconnects Gmail in Integrations (STORY-APP-017): Inbox falls back to "No mail connected"; the Data room button changes after reload.

#### STORY-APP-208: Maya is asked three times to "allow" her documents to be read

**Type**: medium
**Topic**: Consent cards across Inbox, Data room, Legal
**Persona**: Maya who clicks Allow without reading
**Goal**: "Let the app use my documents once, and stop asking."
**Preconditions**: A1 with a model; Data room seeded; **Legal needs PR #109**.
**Ideal path**: 1 if the consent is shared; real path is 3.
**Alternate paths**: Settings, Account, "AI data sharing" (STORY-INB-026).

##### Steps
1. Inbox: card "Let Praci sort your mail"; she clicks **Allow** (STORY-INB-002).
2. Data room: card "Let Praci read your documents"; only **Allow** is offered, no **Not now** (STORY-DRM-009, S-DRM-09).
3. **[needs PR #109]** Legal: card "Let the Legal agent read your documents". The Data room and Legal consent are the same underlying consent, shown with different wording; granting it on one releases waiting items on the other (S-LEG-08, STORY-LEG-004). The Inbox consent is separate (`AiDataSharing` switch per model).
4. She opens Settings, Account, "AI data sharing" to see them all. The page lists one switch per model ("Allow {model name}") and does not list the Data room or Legal grants (STORY-INB-026).
5. She switches the model switch off. The Inbox groups vanish; the Data room card behaviour is not described in any area catalog. **Unverified:** whether the Data room consent changes too.

##### Variations
- She clicks **Not now** in the Inbox card: it returns next visit (STORY-INB-002).

##### Edge Cases
- Providers changed while the Data room page was open: Allow returns CONFLICT with no explanation (S-LEG-08).

---

### Stories: Long journeys

#### STORY-APP-209: Maya's first day, from sign-up to "when do we run out?"

**Type**: long
**Topic**: Onboarding, Gmail, Mercury, Chief
**Persona**: Naive founder, day one
**Goal**: "Sign up, connect my email and my bank, and have the assistant tell me how long our money lasts."
**Preconditions**: Fresh server with a model (STORY-APP-001 setup); MOCK Gmail and MOCK Mercury accounts for Northwind.
**Ideal path**: 14 — sign up, choose "Run my company", Authorize Gmail, Finance, Mercury, ask.
**Alternate paths**: skip the focus card and type (STORY-APP-110); connect Mercury from the Integrations tile (STORY-APP-182); ask the Finance panel instead of Chief.

##### Steps
1. Opens `/`, reads "Bots that run your inbox, cash, cap table and investor documents.", clicks **Sign up →** (STORY-APP-001).
2. Types Name "Maya Chen", Email, Password; clicks the eye ("Show password"); clicks **Create account**. Sees "Loading…" then "Opening chat…". **Hesitation:** two plain loading screens.
3. Lands in Chief's thread. Reads "Hi Maya, I'm Chief. I can sort your email, keep an eye on cash and the cap table…".
4. Sees the card "What do you want me on first?" and clicks **A "Run my company"** (STORY-APP-002).
5. Chief offers Gmail and Google Calendar cards with **Authorize**. Clicks **Authorize** on Gmail; the button reads "Waiting…"; approves in the popup.
6. Chief says to open Finance and Cap table to connect bank and Carta.
7. Clicks **Finance** (`/app/finance`): "No accounts yet" and **Add account** (STORY-FIN-001).
8. Clicks **Add account**: sections Bank (Mercury, Brex, Upload statements) and Crypto. Clicks Mercury; the sign-in window opens; approves.
9. Finance shows "Reading…" then the dashboard with Cash, Burn, Runway. Clicks the refresh icon; "Syncing…" then "Updated just now" (STORY-FIN-003).
10. Clicks **Inbox**: skeleton rows, then mail grouped Today/Earlier. The card "Let Praci sort your mail" appears; she clicks **Allow** (STORY-INB-002) and sees "Sorting your mail…" (STORY-INB-025).
11. Opens **Cap table**: "Connect Carta"; she does not have a Carta account yet. Skips it (STORY-CAP-002).
12. Returns to Chief and types "When do we run out of money?" The reply gives runway and a month.
13. Clicks the bell: "Activity" block lists the run under "Finished" (STORY-APP-124).
14. Opens Finance, **Runway** to compare (STORY-APP-203). **Hesitation:** Chief says "about 8 months", the page "7.9 mo".
15. Sidebar tour: Inbox, Finance, Cap table, Data room, Artifacts, bot list. She asks herself where the Legal page is; it is absent on `main` (STORY-LEG-020).
16. Logs out from the user menu; signs back in; Chief's thread is still there (STORY-APP-107).

##### Variations
- Mercury sign-in cancelled: tile reads "Sign-in was cancelled or did not finish. Try again." (STORY-APP-182).
- Popup blocked: connect card shows a failure (STORY-APP-111).

##### Edge Cases
- Subscription required: paywall appears before step 3 (STORY-APP-004).
- The server has no model: setup asks her to connect one (STORY-APP-108).

#### STORY-APP-210: Maya produces and sends the monthly investor update from the pages

**Type**: long
**Topic**: Finance, Cap table, Data room, Inbox send with approval
**Persona**: Maya, month-end
**Goal**: "Send investors a September update with cash, burn, runway, who owns what, and the board deck attached."
**Preconditions**: NW-BASE Finance; `carta-connected` with snapshot; Gmail connected; Data room has "Board deck Q3.pdf"; contacts list has investors (STORY-CAP-009); Carta agent exists. **The import part needs PR #109.**
**Ideal path**: 10 — figures, draft, attach, approve, confirm.
**Alternate paths**: Chief drafts everything (STORY-APP-025); the Carta agent's skill "Draft this month's investor update" (STORY-CAP-018).

##### Steps
1. Opens **Finance**, reads Cash, Burn, Runway. Clicks **Burn** and clicks a month for the detail page (STORY-FIN-004, 005).
2. Notes the numbers in her head: she will need them as text. Clicks **Ask** on Finance: "How much did we burn last month?" The Finance agent answers.
3. Opens **Cap table**, reads the ownership bar and SAFEs (STORY-CAP-014, 015).
4. Clicks the Carta agent panel suggestion "Draft this month's investor update" (STORY-CAP-018). The agent calls `finance_overview`, reads the cap table and contacts, flags a missing investor, asks for highlights and lowlights.
5. Answers in chat. The agent saves a Gmail draft to Maya with investors in Bcc. **Hesitation:** it is only a draft; it never sends (STORY-CAP-018).
6. Opens **Inbox** and finds the draft. Opens it in the composer (STORY-INB-013).
7. Wants to attach the board deck. Opens **Data room**, searches "board deck", downloads "Board deck Q3.pdf" (STORY-DRM-013).
8. Returns to the composer, attaches the file. A 12 MB deck gives "Attachments can't be over 10 MB." (STORY-INB-011 variation). She compresses it elsewhere, re-attaches.
9. Fixes the subject. Clicks **Send**; "Sending… Undo" shows (STORY-INB-010).
10. Alternatively asks the Inbox agent "send this to investors". A card "Mail Needs approval" appears; she edits the subject with **Edit** and clicks **Send** (STORY-INB-020, 028).
11. Checks the Sent search; opens the thread.
12. Goes back to Cap table and sees nothing changed there; the update is not recorded anywhere in Cap table or Finance (no link between them).
13. **[needs PR #109]** The Data room could instead import the deck from an earlier email thread (STORY-DRM-020).
14. Opens **Artifacts** to see whether the draft was saved; it was not, because the agent saved a Gmail draft, not an artifact (STORY-APP-006).

##### Variations
- Hide amounts on while she reviews with Sam on a shared screen (STORY-APP-201).
- Carta not connected: she types the cap table by hand into the email.

##### Edge Cases
- Send fails: message returns to the composer (STORY-INB-029).
- Chief "Always ask before sending email" is set (STORY-APP-158): changes nothing for the Inbox agent, which always asks.

#### STORY-APP-211: Maya prepares for the board meeting

**Type**: long
**Topic**: Board prep across Inbox, Cap table, Finance, Data room, Legal
**Persona**: Maya, two days before the board call
**Goal**: "Know the numbers, the open issues and the agenda, and not show amounts on the call."
**Preconditions**: A1 with M9 "Board prep" thread; NW-BASE; `carta-connected`; Data room with "Board minutes Q2 2026.pdf"; **Legal needs PR #109** with D2 (overdue "Q3 board consent signature").
**Ideal path**: 12.
**Alternate paths**: Cap table board prep skill (STORY-CAP-020); Chief group "Leadership" (STORY-APP-015).

##### Steps
1. Opens **Inbox**, filters to **Important**, opens M9 "Board prep" and reads the thread (STORY-INB-008, 007).
2. Clicks **Reply all**, writes "Moving prep to 4pm", clicks **Send**; uses **Undo** to change to 4:30 (STORY-INB-010).
3. Opens **Cap table**, checks the Series Seed row and the option pool; "Unallocated pool 900,000" repeats in the card (STORY-CAP-015).
4. Asks the Carta agent "Prepare me for the board" (STORY-CAP-020). It reads ownership, cash and runway from Finance tools, lists open items.
5. Opens **Finance** and **Runway** to confirm the agent's numbers (STORY-FIN-006).
6. Opens **Data room**, searches "board minutes", opens the preview, downloads (STORY-DRM-019 step 5).
7. **[needs PR #109]** Opens **Legal**, **Deadlines**. Sees "Q3 board consent signature" with the red pill "Overdue by 6 days". Clicks **Done** (STORY-LEG-007).
8. Back in Inbox, clicks **Forward** on the board consent email to counsel (STORY-INB-011).
9. Asks Chief "Draft talking points from what we just looked at". Chief does not see the earlier agents' threads (STORY-APP-167). **Hesitation:** she repeats the numbers.
10. Chief replies with a table; she uses **Copy rows** (STORY-APP-014).
11. Turns on **Hide amounts** before the call (STORY-APP-201). Opens Cap table; clicks the Investors tab for names only (STORY-CAP-033).
12. Collapses the agent panel, because a later reply may show plain numbers (STORY-CAP-033 step 6).
13. During the call, a new email arrives; the Inbox list gains it with a small notice (STORY-INB-037).
14. After the call she turns **Show amounts** back on.

##### Variations
- Phone only: skip steps 3 to 7; the list pages work but the dense tables need scrolling (STORY-INB-031, STORY-DRM-030).

##### Edge Cases
- The Inbox agent panel lists "Invoice #4471 … $4,820" in a card even with amounts hidden (STORY-INB-034).

#### STORY-APP-212: A contract renewal, from email to Legal deadline to an approved reply

**Type**: long
**Topic**: Inbox, Data room, Legal, approval-gated reply
**Persona**: Maya, whose office lease renewal notice has arrived by email
**Goal**: "Know when the renewal option expires, tell the landlord yes, and not miss the date."
**Preconditions**: **Requires PR #109.** A1; M-lease "Office lease renewal option" from the landlord (`leasing@halcyon-logistics.example`, MOCK) with the PDF "Office lease renewal option.pdf"; Gmail connected; consents given; Data room empty of the lease.
**Ideal path**: 12.
**Alternate paths**: the Inbox agent files the attachment on its own (STORY-DRM-044); ask Legal agent for the dates (STORY-LEG-016).

##### Steps
1. Opens **Inbox**, sees the notice in "Needs reply". Opens it; reads "Please confirm renewal by 30 November".
2. Taps the PDF chip; it downloads. Only the chip downloads (STORY-INB-015).
3. Opens **Data room**, clicks the envelope ("Import from email"), searches "lease", ticks the PDF, clicks **Import** (STORY-DRM-020). Notice "Imported 1 file". Row shows "Reading".
4. Sets Type to `contract` in the filter to confirm it was classified (STORY-DRM-014).
5. Opens **Legal**. Tile "Unreviewed documents" shows 1. Clicks **Scan now** (STORY-LEG-005).
6. Watches the scan; the **Deadlines** tab now has "Renewal notice deadline · Due in 45 days" and "Renews" in January (STORY-LEG-013). A grey note: "Derived from the expiration date and the notice period."
7. Opens **Graph**, clicks the landlord box to read the quote (STORY-LEG-014).
8. Clicks **Ask agent** and types "What do we owe the landlord and when?" (STORY-LEG-016).
9. Back to **Inbox**, opens the notice, clicks **Reply**, types "We confirm renewal. Please send the countersigned copy." (STORY-INB-009).
10. Instead asks the Inbox agent "reply yes to this". A card "Mail Needs approval" appears; she clicks **Edit**, changes the wording, clicks **Send** (STORY-INB-028). Header reads "Sent by you".
11. A week later the landlord replies with the countersigned PDF. She imports it (steps 2 to 3) and rescans; **Renews** updates to the new date (STORY-LEG-013).
12. In Legal, clicks **Done** on "Renewal notice deadline" (STORY-LEG-012).
13. Asks the Legal agent to "tell me when it renews" next quarter (STORY-LEG-017).

##### Variations
- The scan reads the PDF text with no year ("31 January") and creates no dates (S-LEG-02).
- The landlord's mail has the date only in the body: it is reported in chat and never recorded (S-LEG-04).

##### Edge Cases
- Maya deletes the lease from the Data room: contract and deadlines vanish (STORY-APP-206).
- Gmail needs reconnecting at step 10: "Gmail needs to be reconnected" (STORY-INB-017).

#### STORY-APP-213: Maya runs her day from her phone only

**Type**: long
**Topic**: Phone width across the whole app
**Persona**: Maya at an airport
**Goal**: "Handle email, check cash and equity, and ask for a task without opening the laptop."
**Preconditions**: Full seed (A1, NW-BASE, `carta-connected`, Data room seeded); phone width 390 px.
**Ideal path**: 14.
**Alternate paths**: palette Cmd+K is not available on a phone.

##### Steps
1. Opens the app. The sidebar is a drawer; she taps the menu icon to see Inbox, Finance, Cap table, Data room (STORY-APP-121).
2. Taps **Inbox**. Agent panel is closed even if she left it open on the laptop (STORY-INB-032). Reads the To do card (STORY-INB-040).
3. Taps **Important**, opens M3, taps **Reply**, types "Friday 2pm works.", taps **Send** (STORY-INB-040 step 5).
4. Taps **More** on a newsletter, **Mark noise** (STORY-INB-005).
5. Taps **Ask**; the panel covers the page. Asks "What did Priya say about the term sheet?" (STORY-APP-134).
6. Taps **Finance**. Reads Cash, Burn, Runway. Taps the eye icon to hide amounts because a stranger is looking (STORY-FIN-030).
7. Taps **Runway** and reads the sentence (STORY-FIN-006).
8. Taps **Cap table**. Because Carta is on, the agent panel is a full-screen view; she taps the name button to open it (STORY-CAP-023).
9. Taps **Data room**. The folder is a pill, not a tree; taps it to pick `Finance` (STORY-DRM-030).
10. Searches "lease" in the sidebar search and taps the document result (STORY-APP-119).
11. Taps back; the browser Back goes through folders (STORY-DRM-025).
12. Opens Chief, types "Remind me Friday to send the update" (STORY-APP-153).
13. Chief asks "Allow once / Always allow this tool / Deny" in a card; she taps **Allow once** (STORY-APP-157).
14. Taps the bell: the run is listed under "Working" (STORY-APP-124).
15. Locks her phone. A browser notification arrives when the run ends only if notifications were allowed (STORY-APP-127).
16. Taps **Show amounts** off when done.

##### Variations
- Offline: the app shows a connection banner (STORY-APP-142).

##### Edge Cases
- Dense tables (Cap table, Data room grid) need horizontal scroll (STORY-CAP-022).

#### STORY-APP-214: Maya assembles a fundraising diligence packet

**Type**: long
**Topic**: Data room, Finance, Cap table, Legal, Inbox
**Persona**: Maya in Series A diligence for MOCK Harbor Ventures
**Goal**: "Send Harbor Ventures all customer contracts, the cap table, three bank statements and board minutes."
**Preconditions**: **Parts need PR #109.** S1 + S2 Data room, three statements July to September in `Finance / Bank statements`; model + consent; Gmail connected; `carta-connected`.
**Ideal path**: 18 — the ask is large and the product has no packet or share link (STORY-DRM-022).
**Alternate paths**: share the Data room (not built).

##### Steps
1. Reads Priya's email in Inbox: "Please send customer contracts, cap table, last three bank statements, board minutes." Opens M-diligence (STORY-INB-008).
2. Opens **Data room**, picks Type `contract`; the list shows Contracts (STORY-DRM-015). She cannot select all or bulk download (STORY-DRM-019).
3. **[needs PR #109]** Opens **Legal** to check which contracts are active: Contracts tab, "Active 3" (STORY-LEG-014). Notes two names missing from Data room.
4. Imports the missing two from Gmail with the envelope button (STORY-DRM-020).
5. Back in Data room, searches "cap table"; a file shows **Failed** (STORY-DRM-008). Cannot retry.
6. Opens **Cap table**, with Carta on, clicks **Refresh from Carta** (STORY-CAP-025). Looks for an Export; none. Asks the Carta agent to "summarise the cap table in a table" and uses **Copy rows**.
7. Folders: opens `Finance`, then the sub-folder `Bank statements`; downloads three PDFs (STORY-DRM-011).
8. Searches "board minutes"; downloads (STORY-DRM-019).
9. Opens **Inbox**, **Compose**, picks the From account (STORY-INB-012). Attaches all downloads. Exceeds the size limit; sends two emails instead (STORY-INB-011).
10. Alternatively uploads to Google Drive and shares there; the Data room cannot (STORY-DRM-022).
11. Hides amounts before sharing screen on a call with her lawyer (STORY-APP-201).
12. On the call, asks Chief "Which contracts end in the next 6 months?" Chief answers from what it can read; Legal's table is faster (STORY-LEG-011).
13. Replies to Priya with "Sent in two emails." (STORY-INB-009).
14. Next day Priya asks "everything from Harbor Ventures"; Maya picks the Party "MOCK Harbor Ventures" (STORY-DRM-019 edge).
15. Marks the thread done by archiving; uses Undo once (STORY-INB-004).

##### Variations
- Priya asks to see "the room". Maya looks for **Invite** or **Share** and finds none (STORY-DRM-022).

##### Edge Cases
- Over 50 MB: "Over the 50 MB limit" (STORY-DRM-004).

---

### Stories: Rewritten (kept id)

#### STORY-APP-024: Maya's Monday morning across the whole app

**Type**: long
**Topic**: Moving between features
**Persona**: Naive founder, second week of use
**Goal**: "Check email, cash and equity, file the signed SAFE, and leave Chief a to-do."
**Preconditions**: Full shared seed with 3 unread MOCK mails (one with attachment "Signed SAFE.pdf"); NW-BASE; `carta-connected`. **Steps tagged [needs PR #109] use Data room import.**
**Ideal path**: 10 — Inbox, open mail, file attachment, Finance, Cap table, Chief, ask, done.
**Alternate paths**: download and drag onto any page (STORY-INB-016); ask the Inbox agent panel instead of Chief; Cmd+K to reach bots (STORY-APP-008).

##### Steps
1. Signs in; `/app` opens Chief (STORY-APP-107).
2. Clicks **Inbox**; badge shows 3. Rows grouped by Today/Earlier with a "Needs reply" group when sorting is allowed (STORY-INB-002). The Inbox agent panel is on the right.
3. Opens the SAFE mail (`?mail=<id>`). **Hesitation:** two assistants, the Inbox agent and Chief.
4. Wants it filed. **[needs PR #109]** Data room, envelope ("Import from email"), ticks the PDF, **Import** (STORY-DRM-020). On `main`: downloads it and uses **Choose files** (STORY-INB-016).
5. Clicks **Finance**; reads Cash, Burn, Runway; the Finance panel offers **Ask** (STORY-FIN-002).
6. Clicks **Cap table**; looks for the SAFE in the SAFEs list (STORY-CAP-015). It is not there until Carta syncs; she clicks the **Refresh from Carta** icon (STORY-CAP-025).
7. Presses Cmd+K, types "Chief", Enter (STORY-APP-008).
8. Types "Remind me Friday to send the Q3 investor update". Chief may offer a routine; she accepts (STORY-APP-172).
9. Clicks the bell to see the run, then the bell again (STORY-APP-124).
10. **[needs PR #109]** Opens **Legal**, **Deadlines**, checks that nothing is overdue (STORY-LEG-007).
11. User menu, **Artifacts**, opens last week's update draft (STORY-APP-129).
12. Logs out.

##### Variations
- Phone: STORY-APP-213 and STORY-INB-040.

##### Edge Cases
- Each feature page has its own agent panel, so "the assistant" is a different bot on each page (STORY-APP-167).

---

### Redundancy Candidates (this area)

- Five different "Connect" doorways for five different connections (STORY-APP-207).
- The same document consent appears as three cards with three wordings (STORY-APP-208).
- Hide amounts has three controls (account menu, eye on Finance, eye on Cap table), and none on Inbox, Data room list or Legal (STORY-APP-202).
- Chief, the Inbox agent, the Finance agent, the Carta agent and the Legal agent all answer money and mail questions with different tools (STORY-APP-203, 211).

### Suspected problems (this area)

New ones, found at the seams between areas.

1. **Hide amounts coverage is invisible and uneven.** The helper text names "finance screens" and chat; Inbox subjects, previews and agent cards stay unmasked (STORY-INB-034), Cap table proportions stay visible (CAP-021), and Legal has no eye icon at all (S-LEG-12). A founder cannot learn from the UI which pages are covered. STORY-APP-202.
2. **Legal reads only what is in the Data room, and Data room import does not tell Legal.** After "Imported 1 file", Legal still waits for **Scan now** and the tile only says "Unreviewed documents" (S-LEG-01). No link from the Data room import notice to Legal. STORY-APP-200, 212.
3. **Deleting a Data room file silently deletes contracts and manual deadlines in Legal** (S-LEG-12, STORY-LEG-028) and the Data room's delete confirm does not warn. STORY-APP-206.
4. **Three consent cards for the same idea.** The Inbox "Let Praci sort your mail" consent is stored per model in Settings; the Data room and Legal use a shared consent with a different card. Granting one does not grant the other and there is no combined view. STORY-APP-208.
5. **Each page agent has its own thread, and Chief cannot see them.** A founder who analysed numbers with the Finance panel and then asks Chief gets no context (STORY-APP-167). STORY-APP-203, 211.
6. **Connection state is read once per page open.** Connecting Gmail and returning to the Data room shows "Connect Gmail" until reload (STORY-DRM-041); Finance, Cap table and Legal each re-read at different times. STORY-APP-207.
7. **No packet or share concept anywhere.** A diligence request needs Legal, Data room, Cap table and Finance; the product offers download buttons per file and a per-email 10 MB limit, so the founder repeats many manual steps (STORY-DRM-019, 022; INB-011). STORY-APP-214.
8. **Draft-only investor updates look like sends.** The Carta agent's update ends as a Gmail draft (STORY-CAP-018), the Inbox card says "Approved to send" rather than "Sent" (INB-020), and Chief's mail approval uses a third card. Three outcomes for "email the investors" with different words. STORY-APP-204, 210.
9. **Legal deadlines have no way back to their source email.** Findings in mail are reported only in chat (S-LEG-04), so the deadline row cannot link to the message that created it. STORY-APP-205.


---

## Redundancy Candidates and Suspected problems (all areas)

Each area section above ends with its own "Redundancy Candidates (this area)" and "Suspected problems (this area)". Cross-area items to read together:

- **Connecting an app happens in several places** (Inbox, Finance, Cap Table, Integrations; STORY-APP-176..182, STORY-APP-207).
- **Three "allow the AI to read this" consent cards** (Inbox, Data room, Legal) plus Settings "AI data sharing" with different wording and no combined view (STORY-APP-185, 208).
- **Hide amounts is partial and per browser**: pins, memos, chart shapes, Inbox rows, Cap table bar proportions and the Legal page still show data (STORY-FIN-024..031, 036, STORY-CAP-021, STORY-INB-034, STORY-DRM-034, STORY-APP-128, 201, 202).
- **Talking to a feature's agent** has three doors (side panel, the bot's own page, the sidebar list) and each agent has its own thread Chief cannot see (STORY-APP-209, 210).
- **Deleting a Data room file silently removes the Legal contract and its deadlines** (STORY-LEG-028, STORY-APP-206).
- **Adding a file to the Data room** has five routes on main; none link back to an email (STORY-INB-016, 022, 024; STORY-DRM-020).
- **Two intros stacked** in the empty Inbox agent panel (see the Inbox "Suspected problems").
- **Sign-in and routing**: saved deep links are lost at sign-in; unknown `/app/...` paths redirect or render blank (STORY-APP-106, 140).

---

## New features (2026-10-19)

Thirty stories for five features, kept under their own IDs (not renumbered to STORY-NNN) because other files refer to them. The full story text lives in the topic files; this section only indexes them. Nothing here was walked; status comes from each file's preconditions.

Topic files:

- [Connect apps pill](topics/new-connect-apps.md) (STORY-NA-1..6)
- [Integration agents on Mercury and Brex](topics/new-integration-agents.md) (STORY-IA-1..8)
- [Connected-app agents and Carta](topics/new-connected-app-agents.md) (STORY-CA-1..7)
- [Elio voice agent](topics/new-elio-voice.md) (STORY-EL-1..5)
- [Gmail rate limit notice](topics/new-gmail-rate-limit.md) (STORY-GR-1..4)

### Summary

| Feature | Short | Medium | Long | Total |
|---|---|---|---|---|
| Connect apps pill (NA) | 4 | 2 | 0 | 6 |
| Integration agents (IA) | 5 | 2 | 1 | 8 |
| Connected-app agents and Carta (CA) | 3 | 2 | 2 | 7 |
| Elio voice (EL) | 2 | 2 | 1 | 5 |
| Gmail rate limit (GR) | 4 | 0 | 0 | 4 |
| **Total** | **18** | **8** | **4** | **30** |

### Coverage matrix

| Feature | Covered | Gaps |
|---|---|---|
| NA | First visit, click-through, plain row on the Integrations page, update after connect, slow/failed load, one logo per app | No story for the all-connected state on the demo; the "needs reconnecting counts as connected" rule is untested; mobile sidebar close on click; offline logo fallback (letter tile) |
| IA | Create, read question, allow changes, deny, approve, turn off, Only this agent via Chief, archive and recreate, manual Used by | Brex has no write tool, so no Brex write walk; no signed-out server story; no mobile (the plan has none); rename after agent creation is UNVERIFIED |
| CA | Notion agent create, allow changes and approve, Only this agent vs Used by, Carta defaults, Carta changes on, Carta investor email, App page vs MCP page comparison | Notion is not seeded or emulated; no multi-account app story; no disconnect or remove-account story; Carta writes unobservable (read-only emulator) |
| EL | First call, hang up and re-call, delegate to another agent, private-history denial, call fails to start | No real speech (mic and recognition cannot be driven offline); no group-chat or mobile story; Data room tools for Elio only named as an alternate path |
| GR | Notice in the throttled space, Try again during the pause, notice clearing, Reply fallback | Populated inbox with a throttled account (red line plus Try again) has no story; search while throttled only an alternate path; Forward and Reply all are variations only |

### Dependency graph

```
NA-1 (empty space, pill) -> NA-2 (click) -> NA-4 (connect, pill updates)
NA-3 (plain row)   needs all five featured apps connected (after NA-4 style connects)
NA-5, NA-6         independent

IA-1 create agent -> IA-2 read question
IA-1 -> IA-3 allow changes + deny -> IA-4 approve
IA-3 -> IA-5 turn changes off
IA-1 -> IA-6 Only this agent (Chief asks the agent; write part needs IA-3)
IA-1 (+ IA-3, IA-6 for the full reset) -> IA-7 archive and recreate
IA-8 independent (needs no agent); alternative to IA-1

CA-1 create Notion agent -> CA-2 allow changes + approve
CA-1 -> CA-3 Only this agent vs Used by
CA-4 Carta defaults -> CA-5 Carta changes on
CA-6 Carta investor email   needs Carta agent + Gmail emulator + model
CA-7 compare pages          needs a connected app (Gmail Sales) and Carta; can be compared with CA-1/CA-4

Scripted voice provider (Settings, Voice) -> EL-1 first call -> EL-2 hang up and re-call
Scripted voice provider + model key (pi) -> EL-3 delegate -> EL-4 private history (seed a Finance chat first)
EL-5 runs with NO provider (case A) or a blocked /rpc/voice/agent (case B); do it before connecting Scripted

GR-1 (throttled space) -> GR-2 Try again
GR-3 needs a 429 that stops (failNext hook, not on the demo)
GR-4 needs a cached message + failing single fetch (not on the demo)
```

Cross-feature ordering: IA-6 and CA-3 share the Only this agent switch; reset state between walks (IA-5, IA-6, IA-7 change shared server state). CA-4/CA-5 use the same Agent section component as IA-*.

### Walkable on the mock demo (DEMO_SLOT=7, http://127.0.0.1:5380)

The emulated Mercury now offers `requestSendMoney` in the demo, so the IA approval stories (IA-3, IA-4, IA-6 write part) are walkable; a scripted model may still need to be told to call it. Brex has no write tool, and Carta and Notion writes cannot be tried.

| Story | Status | Reason |
|---|---|---|
| NA-1 | Walkable | Empty demo space has no connections |
| NA-2 | Walkable | Main space shows Calendar, Drive, Slack logos |
| NA-3 | Partly | Only Gmail is connected; plain row shows only while Integrations is open; all-five state is not seeded |
| NA-4 | Partly | Slack sign-in is a real third-party step; pending state only unless the emulator marks it connected |
| NA-5 | Walkable | Throttle or block `connections.featured` / `connections.list` in the browser |
| NA-6 | Partly | Demo catalog has only `SLACK`; alias case covered by a unit test only |
| IA-1 | Walkable | Mercury and Brex seeded, no agent |
| IA-2 | Walkable | Read tools exist in the demo |
| IA-3 | Walkable | `requestSendMoney` is now served; the model must call it |
| IA-4 | Walkable | Follows IA-3 |
| IA-5 | Walkable | Follows IA-3 |
| IA-6 | Walkable | Finance agent seeded; write part uses `requestSendMoney` |
| IA-7 | Walkable | Re-seed first |
| IA-8 | Walkable | Mercury seeded, no agent needed |
| CA-1 | Partly | Notion not seeded or emulated; substitute the Gmail "Sales" account (Create agent button there is UNVERIFIED) |
| CA-2 | Not walkable | Notion writes cannot be tried |
| CA-3 | Partly | Needs a Notion or Gmail Sales agent from CA-1 and two other bots |
| CA-4 | Walkable | Carta (MOCK DEMO) and its agent are seeded |
| CA-5 | Partly | Switch and confirmation dialog work; Carta emulator is read-only so a write cannot be observed |
| CA-6 | Walkable | Gmail emulator and finance data are seeded; needs a configured model |
| CA-7 | Walkable | Gmail Sales and Carta are both seeded |
| EL-1 | Walkable | After connecting the Scripted voice provider in Settings, Voice |
| EL-2 | Walkable | Follows EL-1 |
| EL-3 | Partly | Needs a model key (runtime `pi`); scripted runtime will not call `message_bot` |
| EL-4 | Partly | Same model-key need, plus a seeded Finance chat |
| EL-5 | Walkable | Default demo has no voice provider (case A); case B by blocking the request |
| GR-1 | Walkable | "Mail rate-limited" space always answers 429 |
| GR-2 | Walkable | Same space, within 30 seconds of a failed sync |
| GR-3 | Not walkable | The throttled account never recovers; no `failNext` hook in the demo |
| GR-4 | Not walkable | No cached message in the throttled space; other spaces never fail |

Totals: 19 walkable, 8 partly walkable, 3 not walkable.

### Redundancy candidates

From the files' Alternate paths and multi-surface notes. All are suspected, none walked.

- **Agent controls on two page layouts (CA-7).** `AppDetail` (Notion and other apps) and `McpDetail` (Carta, Mercury, Brex) use the same `IntegrationAgentSection` text but differ as follows:
  - Create agent: inside each account row beside Rename (app page) versus the top action row beside Reconnect and Rename (MCP page).
  - Agent section: nested in the account row versus a top-level block.
  - Used by: replaced by Agent for a linked account (app page) versus always shown and filtered to the agent (MCP page).
  - Tools list with Read and Write groups: app page only.
  - Remove: Disconnect {app} plus Remove account versus Remove {server} plus Disconnect sign-in.
  - Service word and confirm title/body: account name or app name versus "Carta" or server name; confirm text differs slightly.
  - Open Cap table button: Carta only.
- **Three ways to give an app to a bot (IA-8, IA-6, CA-3).** Create an agent, tick Used by per bot, or turn on Only this agent. Used by remains visible on MCP pages even when Only this agent is on.
- **Three ways into Integrations (NA-1, NA-2, NA-3).** The pill, the plain row, and the page search entry plus `/app/integrations`. The sidebar changes look depending on state.
- **Featured-app status shown in three places (NA).** Pill logos, the Popular grid, and per-app status on the Integrations page; connected Gmail also appears in the Inbox.
- **Talking to the Mercury or Brex data from several agents (IA-2, IA-6).** The Mercury agent, the Finance agent (synced data, may differ in freshness) and Chief via Only this agent.
- **Four ways to reach Elio (EL-1).** Call Elio on a bot chat, the same button in the Elio chat, the Elio sidebar entry, and mobile's own entry; before voice is connected the same button goes to Settings, Voice. Ending a call also has Hang up, Escape and a spoken request.
- **Talking to another agent (EL-3).** Via Elio, directly in that agent's chat, or by mentioning the bot in the Elio composer.
- **Retry paths for a throttled inbox (GR-2).** The Try again button, a tab visibility change, and the one-minute new-mail poll all re-run the sync; Forward, Reply and Reply all share one fallback (GR-4).
- **Opening a Carta agent (CA-4).** The Carta page, the Cap table page link and the agent chat.
