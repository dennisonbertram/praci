# Journey critique: approvals in a thread (STORY-035, 040, 043, 045)

Evidence: Swift code in `apps/ios/Sources/Praci/Thread/Approvals/` and the steps in `docs/ios-native/ux/topics/approvals.md` (STORY-001, 006, 009, 011). No device walk. Each claim is marked "measured from code" (M) or "suspected - needs device walk" (S).

**Verdict: acceptable.** The core path (read the card, tap one button) is already at the ideal step count. The friction is in what the card hides before an irreversible action and in the reason line.

## 1. Friction scorecard

| Story | Ideal steps | Actual steps | Decisions | Re-entry | Pointless confirmations | Dead ends | Hesitations |
|---|---|---|---|---|---|---|---|
| 035 allow payment once | 2 | 2 (read, tap `Send $300.00`) (M: `AskCardView.swift:40-64`, `:184-186`) | 1 of 3 buttons | none | none | none | "Always allow" sits one thumb-width from "Allow once" on a payment card (M, `:187`, `:67-74`) |
| 040 send/save/discard mail | 2 | 2 (read, tap `Send`) (M: `MailApprovalCardView.swift:101-107`) | up to 3 (Save, Send, Discard) | none | none (and none needed for Discard if undo existed) | after "Send" there is no undo and no way to edit; to change text the person must type in the composer and wait for a new card (M, header comment `:4-5`) | body cut at 10 lines before an irreversible send (M, `:29`) |
| 043 why it asks | 3 | 3 | 1 | none | none | the reason offers no way to stop the asking; iOS has no "Clear conversation" (S for the thread menu - I did not search the thread menu; catalog finding 9 says it is absent) | "Firewall" is a bare word (M, text comes from the server via `ask.approvalReason`, shown at `AskCardView.swift:31-33`, `MailApprovalCardView.swift:33-35`) |
| 045 two cards waiting | 4 | 4+ (scroll, answer, scroll, answer) | which card is live | none | none | no "next pending approval" control (M: nothing in `ThreadModel` card code jumps to a card; `canAnswerAsk` only gates buttons, `ApprovalModel.swift:82-86`) (S for the thread scroll behavior) | old cards say "No longer active" (M, `AskCardView.swift:47`) |

Overall: no re-entry, no confirmation dialogs, one tap per decision. This is minimal on step count.

## 2. Take-away pass per screen

**Tool-approval card (STORY-035)** (`AskCardView.swift:26-38`)
- Question text, detail well, three buttons, reason footnote. Hierarchy is right: the prominent button is `Allow`, `Deny` is quieter (M, `:67-74`; `ApprovalCardView.swift:138-150`).
- Removable or deferrable: the "Always allow" button on a payment tool. A first-time user sees a permanent grant offered at the same weight as a one-time grant. For tools whose label carries an amount (`Send ` prefix, `:186`) the permanent grant makes little sense; move it to the card's long-press or to Settings > "Allowed without asking". (M for the prefix check; S for the product decision.)
- `Deny` is styled `.destructive` but the button style falls back to the same grey `.bordered` tint as secondary (M, `ApprovalCardView.swift:146-148`); the destructive color only shows on the label. Fine.
- The detail well is clipped to 4 lines (M, `AskCardView.swift:94`). For a payment, the arguments are what the person is approving; clipped text is a trust problem more than a clutter problem. Keep the well but make it expandable (see JA-2).

**Mail card (STORY-040)** (`MailApprovalCardView.swift:17-40`)
- Header shows subject plus a "Needs approval" pill (`:23`, `:56-60`). The pill duplicates what the three buttons already say, and the card is the last thing in a thread that is waiting. Removable. (M)
- Three buttons stacked full width (`:93-113`). When the tool can send, "Save" and "Send" are both offered next to "Discard". "Save" is a draft-for-later; it is a legitimate third option but is visually equal in size to Send. Make "Save" a text-weight action under the primary pair. (S: depends on how often people save.)
- Body clipped at 10 lines (`:29`). No "Show all". (M)
- "Cc" and "Bcc" rows only render when non-empty (M, `:43`). Good, already progressive.
- Reason footnote only while interactive (M, `:33`). After the answer nothing says why it asked (also in the topic file: "Edge Cases"). That is acceptable, nobody needs the reason after the fact.

**Reason line (STORY-043)**
- Single grey footnote under the buttons (M). The person has to read buttons first, then the reason, which is the wrong order: the reason is what decides whether to approve. (S: needs a device look at how much of the card is visible without scrolling.)
- "Firewall" is a label for a feature name, not a reason. The server owns the text (M: no string "Firewall" in the iOS sources; it arrives in `approvalReason`), so the fix is a server copy change plus an iOS tap target.

**Two cards (STORY-045)**
- Old cards render a grey "No longer active" line (`AskCardView.swift:46-47`) or "Replaced by a newer request" (`:142`). These are two phrases for "this can't be answered". Keep one. (M)
- Only the card matching `answerableAskMessageID` is interactive (M, `ApprovalModel.swift:82-86`), which already prevents approving the wrong card. That is the right design.

## 3. The simpler version

### STORY-035 / 040 (answer a card)
1. Open the thread; the live card sits at the bottom with its reason above the buttons.
2. Tap the one prominent button (Send $300.00, or Send).

Changes to get there:
- Put the reason sentence before the buttons, directly under the question (JA-1).
- Drop the "Needs approval" pill from the mail card; the buttons and the thread already say it (JA-3).
- Make the clipped detail well and the 10-line mail body expandable in place (JA-2).
- Offer "Always allow" only for tools without an amount in the label (JA-4).

### STORY-043 (why it asks)
1. Read the reason (above the buttons).
2. Answer, or tap the reason to open a one-line explanation with "Stop asking in this chat" (the iOS equivalent of the web "Clear conversation").

This changes step 3 of the ideal path ("she would need to clear the conversation, which iOS cannot do") into one tap. (JA-5)

### STORY-045 (two cards)
1. Open the thread; it already lands at the latest card (S, need device).
2. Answer the live card; the next live card is the only one with buttons.

Already minimal if the thread scrolls to the latest card. Adding a "Next approval" jump is only worth it for threads with many cards, which the catalog does not show as common. Do not build it yet.

## 4. Clarity issues

| Label | Where | Problem | Suggest |
|---|---|---|---|
| "Firewall" | server `approvalReason` shown at `AskCardView.swift:32`, `MailApprovalCardView.swift:34` | A product name used as a reason; says nothing about what happened | "Mail from unknown senders was read, so sending asks first." Needs server copy; wording is a proposal, not a measured value |
| "Allow once" vs "Allow for this run" (`AskCardView.swift:185-186`) | tool card | Two near-synonyms; "run" is jargon | Use "Allow once" for both unless the scope truly differs; if it does, say "Allow until this finishes" (S, needs the server meaning) |
| "Needs approval" / "Not waiting for approval" / "No longer active" / "Replaced by a newer request" / "Stopped" / "Expired" | `MailApprovalCardView.swift:57-61`, `AskCardView.swift:47`, `:142-144` | Six wordings for "you can't answer this anymore" | Collapse to "No longer active" with the outcome only when the person answered it |
| "Discard" on a mail card | `MailApprovalCardView.swift:110` | In a draft-save flow "Discard" could mean the saved draft; it actually denies the agent's request (M, `:118`) | Keep "Discard" when no draft exists; "Don't send" is clearer for a send-only tool (S) |

## Proposals

| id | Problem + evidence | Proposal | Steps saved | Risk | Size | Device walk |
|---|---|---|---|---|---|---|
| JA-1 | Reason line sits below the buttons (M, `AskCardView.swift:30-33`; `MailApprovalCardView.swift:32-35`). STORY-043: reason is read after the decision controls. | Move the reason line above the buttons on both cards. | 0 steps, 1 look-back | low | S | y (check card height on a small phone) |
| JA-2 | Detail well clipped at 4 lines (M, `AskCardView.swift:94`); mail body clipped at 10 lines (M, `MailApprovalCardView.swift:29`) before an irreversible approval. STORY-035, 040. | Tapping the clipped text expands it in place (`lineLimit(nil)`), no new screen. | 0, but removes a blind approval | low | S | n |
| JA-3 | "Needs approval" pill on the mail card repeats what the buttons say (M, `MailApprovalCardView.swift:23`, `:56-60`). STORY-040. | Show the status text only when it is a result (Sent, Discarded, Not sent). | 0 (removes one visible element) | low | S | n |
| JA-4 | "Always allow" is offered at equal weight on payment cards (M, `AskCardView.swift:187`; label prefix check `:186`). STORY-035. | Hide "Always allow" when the allow label carries an amount; the person can still add it from Settings > "Allowed without asking". | 0, reduces a risky choice | medium (policy decision) | S | n |
| JA-5 | The meeting-reason repeats and iOS cannot clear it (M per topic file STORY-009 and catalog finding 9; `AskCardView.swift:31-33` has no action). STORY-043. | Make the reason tappable: one-line explanation plus "Stop asking in this chat" calling the same action as the web "Clear conversation". Needs an RPC check. | removes a dead end (currently requires the web app) | medium (needs the web RPC name; I did not verify it) | M | y |
| JA-6 | "Firewall" is unexplained (M: not present in iOS sources, comes from server). STORY-043. | Change the server reason text to a sentence (see clarity table). | 0 | low | S (server) | n |
| JA-7 | Six phrases for an unanswerable card (M, `AskCardView.swift:47`, `:142-144`; `MailApprovalCardView.swift:57-61`). STORY-045. | Collapse to one "No longer active" line for not-answerable states. | 0 | low | S | n |
| JA-8 | `Save` and `Send` stacked at equal width plus `Discard` (M, `MailApprovalCardView.swift:93-113`). STORY-040. | Keep `Send` prominent, render `Save` as a text button beside `Discard`. | 0 (one fewer large target) | low | S | y |
