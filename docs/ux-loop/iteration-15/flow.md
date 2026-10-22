# Iteration 15 - FLOW critic

Target: mock demo (web :5381), session uxl15-FLOW, 1440x900, existing account (first run not repeatable). Screenshots in /tmp/uxloop15/flow/. Not measured: first-run sign-up/model/tour (account already past it), bot creation, approvals and payments (would create data), phone width, OAuth steps (BLOCKED).

## Findings

### FLOW-01 Inbox shows "Sorting your mail..." for about a minute, and rows are not dimmed
- Story/page: Inbox (daily triage). P2, flow/perf. Observed; cause suspected (demo has no model key).
- Happened: the spinner and five grey skeleton rows stayed up for more than 15 s, then the plain date-ordered list appeared under the spinner; rows were not dimmed (decision: unsorted rows dim after 15 s). After about 60 s the line changed to "Sorting is taking longer than usual. Your mail is below. [Try sorting again]". No "Needs reply" group appeared (`inbox2.png`, `inbox3.png`, `inbox4.png`, `inbox5.png`).
- Expected: the list is usable at once, rows dim at 15 s, and the "longer than usual" line shows at about 15 s, not 60 s.
- Fix: move the "taking longer" fallback and the dimming to the same 15 s timer.

### FLOW-02 Data room opens pre-filtered to "Status: Failed" from the sidebar row
- Page: Data room (raise journey). P2, flow. Observed; code confirmed (the code comment says this is deliberate).
- Happened: with failed files the sidebar link goes to `/app/data-room?status=failed` (`apps/web/src/pages/Shell.tsx:4658`). Maya sees three failed rows and a folder tree, with no sign that other files may exist unless she notices the "Status: Failed" chip (`dr.png`). Each failed row offers only Delete, no replace or retry.
- Expected: the sidebar row opens the whole Data room; the badge or a banner is the way into failed files.
- Fix: link the row to `/app/data-room` and let the red badge open the failed view; add "Replace" on a failed row.

### FLOW-03 Opening a second space creates a second "Chief" with a fresh first-question card
- Page: sidebar spaces. P2, flow. Observed (accidental click on "Open" in the "Reconnect needed" space header, `reconnect.png`, `inbox.png`).
- Happened: a second Chief appeared in the sidebar with the card "What do you want me on first?" while Maya had answered it in the first space; two rows named "Chief" are visible at once, and the Inbox title only shows "Reconnect needed" in small grey text (`inbox.png`). The sidebar keeps listing the first space's chats, so the page content and the list disagree on the current space.
- Expected: opening a space that is not the main one does not create data; the card is not repeated; the active space is marked in the sidebar.
- Fix: do not auto-create Chief on "Open"; if created, name it by its space and skip the first-question card after it was answered once.

### FLOW-04 Sidebar rearranges between pages
- Page: sidebar. P3, visual. Observed.
- Happened: "Page agents" is open on Inbox, Finance and Legal and closed on Contacts and Artifacts, so the list below shifts; the second space is cut under the footer (`p-Contacts.png`, `p-Artifacts.png`, `p-Legal.png`). Improvement since iteration 14: it now lists only the current page's agent.
- Expected: one open/closed state across pages.
- Fix: remember the group's state instead of auto-opening per page.

### FLOW-05 Finance chart shows a stray "8" at Oct
- Page: Finance. P3, visual. Observed, with Hide amounts on (`p-Finance.png`, near the "Oct*" label).
- Happened: a small "8"-like mark sits above Oct* next to the "Financing, Oct" callout.
- Fix: check what the marker is with amounts hidden; hide it or label it.

### FLOW-06 Google Calendar and Drive are still separate Connect buttons
- Page: Integrations, Chief first-run cards. P3, flow. Observed on Integrations (`integ.png`); carried from iteration 14 FLOW-09. OAuth BLOCKED.
- Fix: one "Connect Google" card if a single consent covers all three.

### FLOW-07 Fundraising Round and Pipeline are permanent grey skeletons next to real SAFE rows
- Page: Fundraising. P2, visual. Observed (`p-Fundraising.png`). Another session owns this page; no P0/P1 found, so noted only.

## Re-measured, no change needed
- Settings: General, Privacy and approvals, Models, Advanced; time zone and notifications only in General (`set1.png`, `set2.png`). Consent is one switch plus "Per model and documents".
- Cmd+K empty state lists the eight pages (`cmdk.png`). Account menu: Settings, Integrations, Hide amounts, Take the tour, Log out (`acct.png`). Create menu: New bot, New group, New space (`create.png`). Integrations doors unchanged (decided).

## Praise (observed)
- Finance: five tiles in one row, "Amounts hidden - Show", and the Upcoming list (`p-Finance.png`).
- Hide amounts also masks the amount in an email subject ("$..." in Inbox).
- Legal: Contracts, Deadlines with "1 overdue", and a one-line "3 Data room documents not yet checked" with Review (`p-Legal.png`).
- Integrations: Connected group with "Open Inbox/Finance" and "Used by" avatars (`integ.png`).
- Contacts and Artifacts: clean, one search and one filter each.
