# Verification: Contacts UX (2026-10-20, independent verifier)

All K1-K9 acceptance criteria were measured in the live demo at 375x812, 768x1024, 1280x800 (Cap table with the Carta panel open) and 1920x1080. Dark theme throughout; light theme for K2 and K5. Screenshots are in `shots/`. Every criterion **passed**. One exception was not measured: the K3 nested-button guard, because no row in the demo has a nested button (unit tests cover it).

Key measurements:
- **K2.** With a real agent toast showing, `elementFromPoint` at Undo returns Undo. With a coarse pointer emulated through CDP, Undo is 53x44 and the close X is 44x44. A 90-character name fits in 2 lines. Undo restores the contact and focuses the restored name.
- **K1.** At 375x500 the dialog spans 16 to 484, the body scrolls, and the footer stays pinned. At 375x812 with 2,000 characters of notes, Save stays in view.
- **K3.** Clicks on the name, cells and padding open the contact. Enter opens it once. The cursor is a pointer on contact rows and the default on Carta-only rows.
- **K4.** `aria-invalid`, `aria-describedby`, and focus on Email after a failed Save.
- **K5.** The highlight is visible in both themes.
- **K6.** Focus returns to Search after Clear filters.
- **K7.** At 1280 with the panel open: Shares is visible, Email hidden, Name 252px. At 1920 the table is 1024px wide. Single-line rows are 37px.
- **K8 and K9.** Phone second lines, no orphan dash, the "Added by" divider, and the centred load error.

Journeys re-walked, all passing: search "law"; add by hand, then edit; Chief saves a contact that shows "Added by Chief"; Cap table delete and Undo; other dialogs (Connect Slack, Connect Coinbase, Import from email) at 1440, 375 and 375x500; agent toasts without an action.

P3 findings:
- F1: an agent toast stacked behind the Undo toast cannot be closed until the front toast goes.
- F2: on Cap table, the deleted row lingers for about 0.6s, and focus after Undo arrives after about 1.5s.
- F3: at 1920 the Name column is wide (this follows K7).
- F4: the Connect app dialog is full width at 375. This predates the branch and comes from ConnectAppDialog's own max-width.
- F5: the name's focus ring touches the text and the row outline.
- F6: on Cap table, contact-only rows show a blank Ownership cell while Carta rows show a dash.

Remaining P0-P2 issues: 0
