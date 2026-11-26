# Brief
Praci is a planned native SwiftUI iPhone app (startup operating system): a team talks to AI bots and pages (Inbox, Finance, Legal). These boards are static design mockups on iPhone Duo: outer display 466x678 pt with a side control strip next to the Dynamic Island; inner display 890x626 pt.
Persona: a startup founder triaging mail on the phone, one-handed, wanting to reach inbox zero fast, reply to the few messages that matter, and bulk-clean newsletters.
Screens (multi-frame grids of states):
- PG-A-Compose: write, reply, edit draft, discard, send errors.
- PG-A-Cleanup: bulk archive/unsubscribe by sender, confirm, progress, failure, undo, history.
- PG-A-InboxMessage: read a message or thread, reply menu, attachment preview, unsubscribe row, archive/undo.
- Sheet: Inbox on the outer display (swipe, undo, empty/error/consent/first sync states).
- Split: inner display sidebar plus Inbox.
- Inner-Message: inner display Inbox list plus open message.
Judge: does the user know where they are, what to do next, can they do it in few taps; hierarchy, density, consistency across siblings.
